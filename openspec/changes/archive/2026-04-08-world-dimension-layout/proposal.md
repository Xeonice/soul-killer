## Why

世界（world）的数据在创建后散乱难维护：维度（history/factions/figures/...）在 plan/capture/distill 三个阶段都是一等公民，但落盘时全部平铺到 `entries/` 目录，维度信息只剩下 frontmatter 上的一个标签。作者打开磁盘看不到维度的全貌，编辑某个维度的内容必须切换 N 个文件。更严重的是 history 维度——LLM 把"重大事件"识别为 chronicle pair 后，产物会被静默写到 `chronicle/timeline/` 和 `chronicle/events/`，作者完全看不到 history 维度的内容跑到哪里去了。

同时 history 维度的 distill prompt 鼓励"写 5-10 句的分析文"，chronicle 是可选附加字段且门槛严格（需同时满足时间锚点、影响范围、引用频率三条件），导致 LLM 倾向不输出 chronicle，最终生成的世界**几乎没有清晰的时间线**。

## What Changes

**结构层（按维度分目录）**
- **BREAKING** 世界目录布局从 `worlds/<name>/entries/*.md` 平铺改为 `worlds/<name>/<dimension>/*.md` 子目录划分
- 每个维度子目录下生成 `_index.md` 维度总览（distill 时统一刷新，作者视图，runtime 跳过 `_` 前缀文件）
- **BREAKING** 删除 `chronicle/` 子目录，timeline 和 events 都迁入 `history/` 维度目录下
- 不写迁移脚本，删除现存两个测试 world 重建

**history 维度特殊布局**
- `history/timeline.md` ——单文件按 `## ` 切段的编年史，runtime 真正读取并注入
- `history/events/<name>.md` ——事件 detail 散装文件，按 keyword 召回
- `history/<name>.md` ——非事件性 history entry（长期趋势、制度演变等）
- `history/_index.md` ——同其他维度

**history distill 改 timeline-first 三 Pass**
- **Pass A**：Timeline 提取（一次 LLM call，列穷尽，不分析，输出 sort_key/display_time/name/one_line/source_excerpt）→ 写入 `history/timeline.md`
- **Pass B**：事件 detail 扩写（每个 timeline 条目一次小 LLM call，可并发）→ 写入 `history/events/*.md`
- **Pass C**：非事件性 history 内容（一次 LLM call，论文模式）→ 写入 `history/*.md`
- 删除 `buildChronicleGuidance()` 和 `expandChroniclePair()`
- 其他 8 个非 history 维度仍走单 pass extract 流程

**搜索 plan 微调**
- `history.queries` 加 2 条：`'{localName} 年表'`、`'timeline of {name}'`
- title/url 含 `timeline`/`年表`/`chronology` 的 search result 排序提前

**ContextAssembler 适配**
- `loadAllEntries` 遍历所有维度子目录，跳过 `_*.md`
- `loadChronicleTimeline` 改为读 `history/timeline.md` 单文件按 `## ` 切段
- `loadChronicleEvents` 改为 `ls history/events/`
- runtime 装配逻辑（scope/mode/priority 过滤、token budget、注入顺序）零修改

**默认决策（无需用户每次确认）**
- LLM 不给 dimension 时保留 `inferDimensionFromScope()` 兜底，review 阶段加日志
- `timeline.md` 合并：首次 distill 全量写；evolve 增量按 sort_key 插入；冲突保留作者版本
- `_index.md` 仅在 distill/evolve 时刷新
- Pass A 的 sort_key：LLM 在本世界内单调递增即可，display_time 保留原文字面，无法判断标记 `sort_key_inferred:false` 走 review UI

## Capabilities

### New Capabilities
- `world-dimension-directory`: 按维度划分的世界目录布局规范，包含 `_index.md` 总览文件的生成、`_` 前缀文件的 runtime 跳过约定，以及维度归属的兜底策略
- `history-timeline-distill`: history 维度专属的 timeline-first 三 Pass distill 流程（Pass A 列时间表 / Pass B 扩写事件 detail / Pass C 非事件性内容）

### Modified Capabilities
- `world-entry`: entry 的存储路径和加载规则改为按维度子目录组织，`addEntry`/`loadAllEntries` 路径解析重写
- `world-chronicle`: timeline 从"目录 + 多文件"改为"单文件按段切分"，events 路径从 `chronicle/events/` 迁到 `history/events/`，删除 chronicle/ 顶级子目录
- `world-distill`: history 维度改走三 Pass 流程，其他维度的 extract 仍保留；新增 `_index.md` 自动生成步骤；`writeEntries` 按 `meta.dimension` 分流到子目录
- `world-context-assembly`: 路径解析适配新布局，runtime 装配逻辑不变
- `world-dimensions`: history 维度的 search queries 新增 2 条，加入 timeline-bias 关键词
- `search-result-confirm`: 可选——title/url 含 timeline/年表/chronology 的结果排序提前

## Impact

**受影响代码**
- `src/world/entry.ts`（路径解析重写）
- `src/world/chronicle.ts`（timeline 单文件 + events 路径迁移）
- `src/world/distill.ts`（writeEntries 分流 + history 三 Pass + `_index.md` 生成）
- `src/world/context-assembler.ts`（路径适配）
- `src/agent/strategy/world-dimensions.ts`（history queries +2）
- `src/agent/search/*`（可选 result boost）
- `src/export/packager.ts`（打包目录映射）
- `src/export/skill-template.ts`（Phase 1 LLM 读 chronicle 路径）
- `src/cli/components/world-distill-panel.tsx`、`world-distill-review.tsx`（UI 路径展示）
- `tests/integration/`、`tests/unit/`（写死路径的测试全扫）

**受影响数据**
- 现存 `~/.soulkiller/worlds/` 下两个测试 world 直接删除重建，不写迁移
- 已导出的 `.skill` 包格式向后不兼容（不影响使用，但 Phase 1 加载逻辑要更新）

**不动**
- soul 全部（identity/style/behaviors 已经集中，不需要改）
- agent loop / planning agent 流程
- 8 个非 history 维度的 distill 行为
- runtime 装配的 scope/mode/priority 过滤逻辑
