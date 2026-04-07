## Context

世界（world）系统的数据布局演变到现在暴露了结构性问题。维度（history/factions/figures/geography/systems/society/culture/species/atmosphere）在以下阶段都是一等公民：

1. **Planning** (`src/agent/planning/planning-agent.ts`) — 按维度生成搜索计划
2. **Capture** (`src/agent/capture-agent.ts`) — 按维度分片搜索，结果缓存到 `~/.soulkiller/cache/search/<session>/<dim>.json`
3. **Distill classify/cluster** (`src/world/distill.ts`) — 按维度分组聚合 chunks
4. **Distill extract** — 按维度并行调用 LLM（CONCURRENCY=5）

但在 **distill 的最后一步** `writeEntries()`，所有 `GeneratedEntry` 统一写入 `entries/` 平铺目录，维度信息降级为 `frontmatter.dimension` 一个字段。runtime 的 `ContextAssembler` 也只按 `scope`/`mode` 过滤，不读 `dimension`。

于是维度"活到最后一刻被埋掉"。作者在磁盘上看到的是 30+ 个扁平 `.md`，想 review 某个维度只能 grep frontmatter。

### history 维度的额外不对称

history 维度是全系统唯一一个走"双产物"路径的维度。`distill.ts:595` 和 `:203` 有 `isHistoryDim` 判断，走 `buildChronicleGuidance()` 扩展 prompt，允许 LLM 输出 `chronicle` 字段。一旦输出，`expandChroniclePair()` 把单个 LLM item 拆成两个 `GeneratedEntry`：
- `chronicleType: 'timeline'` → `chronicle/timeline/<name>.md`（一行 body，mode: always，priority: 950）
- `chronicleType: 'events'` → `chronicle/events/<name>.md`（完整 body，mode: keyword，priority: 800）

两个文件靠**同名 stem** 隐式绑定。`chronicle/` 是一个独立于 `entries/` 的顶级子目录。

结果：
- 作者打开 `entries/` 几乎看不到 history 维度内容——它们全部隐身到 `chronicle/`
- `chronicle/timeline/` 下是 N 个一行小文件，作者想调整时间顺序必须逐个开文件改 `sort_key`
- `chronicle/events/` 的 detail 同样散装

### history distill 的"反时间线"倾向

`distill.ts:210-228` 给 LLM 的指令是"create 2-5 detailed world entries, each 5-10 sentences, explain WHY and HOW, detailed and analytical"——这是**写论文**的指令。`buildChronicleGuidance()` 的 chronicle 字段是**可选附加**，且门槛严格（三条件）：

```
A major event meets ALL of:
  1. concrete time anchor
  2. impact reaches beyond single individual
  3. referenced repeatedly in later parts of the world
```

LLM 被鼓励挑 2-5 个主题写分析，chronicle 是"顺便做的事"。结果生成的世界几乎没有清晰的时间线——要么事件不够"重大"被跳过，要么 LLM 专注于写制度/结构分析。

## Goals / Non-Goals

**Goals:**
- 作者打开世界目录能**一眼看到所有维度**，编辑某维度时文件集中在一个子目录
- history 维度的产物**显式落在 `history/` 下**，不再隐身到 `chronicle/`
- history 维度**无论素材如何**都能产出一条清晰的时间线（timeline.md 非空）
- `timeline.md` 是**单一可编辑入口**，作者可以在一个文件里增删调序
- runtime 装配逻辑（scope/mode/priority 过滤、token budget、注入顺序）**零改动**
- 其他 8 个维度的 distill 行为**不受影响**

**Non-Goals:**
- 不写迁移脚本（现存两个测试 world 直接删除重建）
- 不改 soul 结构（identity/style/behaviors 已经集中）
- 不改 agent loop、planning agent、capture agent 的流程
- 不改 runtime 的 scope/mode/priority 语义
- 不改非 history 维度的 distill prompt
- 不支持"无维度"entry 的落盘（所有 entry 必须有 dimension，没有走 `inferDimensionFromScope` 兜底）

## Decisions

### D1. 按维度分子目录，`_` 前缀跳过

**选择**：`worlds/<name>/<dimension>/*.md`，每个维度一个子目录。`_index.md` / `_*.md` 约定为"作者视图"，runtime 的 `loadAllEntries` 跳过所有 `_` 开头的文件。

**备选**：
- (a) 平铺 + 自动生成 `_dimensions/<dim>.md` 索引 → 编辑还是散，只是多了只读索引，拒绝
- (b) 按 scope（background/rule/lore/atmosphere）分目录 → scope 是 runtime 语义不是作者心智模型，拒绝
- (c) 维度按 scope 嵌套两层（`<scope>/<dim>/*.md`）→ 过度嵌套，拒绝

**为什么 `_` 前缀**：需要一种约定区分"作者视图文件"和"真 entry 文件"。`_` 前缀在 Unix 生态里是"隐藏/元数据"的通用约定（npm private package、Jekyll drafts），比 `.hidden` 更显式。

### D2. history 维度的 `timeline.md` 是单文件，不是目录

**选择**：`history/timeline.md` 是一个 markdown 文件，按 `## ` 切段，每段是一个 timeline 条目。格式：

```markdown
---
type: chronicle-timeline
dimension: history
mode: always
---
# 三国编年史

## 184 — 黄巾之乱
> ref: ./events/yellow-turban-rebellion.md
> sort_key: 184
张角发动黄巾起义，东汉中央失控

## 200 — 官渡之战
> ref: ./events/battle-of-guandu.md
> sort_key: 200
曹操以少胜多击败袁绍，统一北方
```

**备选**：
- (a) 保留 `history/timeline/` 目录 + N 个小文件 → 不解决痛点，拒绝
- (b) YAML 数组 → 不符合项目其他地方 markdown + frontmatter 的风格，拒绝
- (c) JSON → 同上，拒绝

**为什么单文件 + `## ` 切段**：作者能在一个编辑器窗口里看到所有事件、调整顺序、编辑描述。runtime 按 `## ` split，读出 `sort_key` 和 body，拼成一个 always 注入块。Event detail 文件通过 `> ref:` 引用显式绑定（不再靠"同名 stem 隐式绑定"），允许 timeline 上有"无 detail 占位条目"。

### D3. history distill 改三 Pass

**选择**：history 维度走独立的 `runHistoryThreePass()`，其他维度继续走现有单 pass `extract`。

```
Pass A: Timeline 提取（列表模式）
  ├─ 输入: history 维度所有 article chunks
  ├─ prompt: "列出每一个带时间锚点的事件，不要分析，不要挑选"
  ├─ 输出: JSON array [{sort_key, display_time, name, one_line, source_excerpt}]
  └─ 写入: history/timeline.md（全量重写）

Pass B: 事件 detail 扩写（论文模式，并发）
  ├─ 输入: Pass A 的每个 item 的 source_excerpt + 原 chunk 上下文
  ├─ prompt: "用 5-10 句话写出这个事件的起因、经过、影响"
  ├─ 输出: 每个 item 一份 detail
  └─ 写入: history/events/<name>.md

Pass C: 非事件性 history 内容（论文模式）
  ├─ 输入: Pass A 未消费的 history chunks（按 source_excerpt 差集推断）
  ├─ prompt: 现有 extract prompt
  ├─ 输出: 2-5 个普通 entry
  └─ 写入: history/<name>.md
```

**为什么三 Pass 而不是单 call 带 chronicle 字段**：LLM 在"写 2-5 篇分析"的格子里会**自我审查**——"这个事件不够大/不够典型，不写进 chronicle"。把 timeline 提取强制拆成独立 Pass 且**不允许写分析**，LLM 没有退化成论文的余地。Pass A 的 prompt 明确说"列穷尽"，门槛只有一个"有没有时间锚点"——binary 判断 LLM 很擅长。

**为什么保留 Pass C**：不是所有 history 内容都是事件。"九品中正制的演变"、"东汉末年士族崛起"这类长期性、非时点性内容应该保留为普通 entry，而不是硬塞进 timeline。

**并发策略**：Pass B 按 timeline 条目数并发（同现有 `distillFromCache` 的 CONCURRENCY=5），Pass A 和 Pass C 各一次 LLM call。整体延迟 ≈ 单次 extract 的 2-3 倍，可接受。

### D4. `_index.md` 自动生成时机

**选择**：仅在 `distill()` 和 `evolve()` 结束前统一刷新所有维度的 `_index.md`，作者手工编辑 entry 后**不**自动刷新。

**备选**：
- (a) 每次 `addEntry`/`removeEntry` 触发刷新 → 对 evolve 之外的场景增加意外 I/O，拒绝
- (b) 文件系统 watcher → 复杂度爆炸，拒绝
- (c) 运行时按需生成 → `_index.md` 是作者视图，runtime 不用，浪费，拒绝

**Trade-off**：作者手工改 entry 后 `_index.md` 会短暂过期。解决办法是作者想要最新索引时重跑 distill 或（未来可加）`/world rebuild-index <name>` 命令。

### D5. `timeline.md` 合并策略

**选择**：
- **首次 distill**：全量写入
- **evolve**：按 `sort_key` 插入新条目，**保留作者对已有条目的编辑**
  - 如果 evolve 生成的条目 stem 已存在于 `timeline.md`：默认保留作者版本，日志 warn
  - 如果 stem 不存在：按 `sort_key` 插入到正确位置

**备选**：
- (a) evolve 全量重写 → 冲掉作者手工调序，拒绝
- (b) 提示用户每次选 → UI 负担重，拒绝

### D6. 不写迁移脚本，删除重建

**选择**：proposal 明确说明现存 `~/.soulkiller/worlds/` 下的测试 world 直接删除重建。

**为什么**：用户确认只有 2 个测试 world，写迁移脚本的成本远高于重跑一次 create。迁移代码有且仅有一次使用价值，之后变死代码。

**影响**：已经导出的 `.skill` 包会变成旧格式，需要用户重新 export。用户已接受。

### D7. 路径解析集中到 `entry.ts`

**选择**：所有"给定 world name 和 entry meta 计算文件路径"的逻辑集中在 `entry.ts` 的一组函数里：
- `getEntryPath(worldName, meta) → string`
- `getDimensionDir(worldName, dimension) → string`
- `getHistoryEventsDir(worldName) → string`
- `getHistoryTimelinePath(worldName) → string`

`distill.ts`、`chronicle.ts`、`packager.ts`、`context-assembler.ts` 都通过这些函数获取路径，不再硬编码 `path.join(worldDir, 'entries', ...)`。

**原因**：路径约定是"按维度分子目录 + history 特殊化"，散在多处容易漏改。

### D8. history 的 search query 微调 + 可选 result boost

**选择**：
- `world-dimensions.ts` 的 `history.queries` 追加 2 条：`'{localName} 年表'`、`'timeline of {name}'`
- 在 `src/agent/search/title-filter.ts` 或 search backend 层加 title/url 含 `timeline of|年表|chronology` 的结果 +10 分 boost

**为什么微调而不是大改**：现有 query 已经是 history 向的（`timeline events`、`wiki chronology`、`历史 时间线`、`大事件`），问题不在于"搜什么"而在于"distill 怎么处理搜到的"。query 微调是 free upgrade，result boost 是锦上添花。

### D9. `inferDimensionFromScope` 兜底保留

**选择**：classify 阶段 LLM 偶尔不给 `dimension` 字段时，继续用 `inferDimensionFromScope()` 兜底。在 review 阶段增加一行日志：`"X entries had inferred dimension"`。

**为什么不强制**：重试 LLM 成本高且不保证收敛；当前兜底规则足够合理（`background→history`, `rule→systems`, `lore→factions`, `atmosphere→atmosphere`）；日志足以让作者后续人工修正。

## Risks / Trade-offs

**[R1] distill 总耗时上升**：history 三 Pass 相比单 pass 多 1-2 倍 LLM 调用。→ Mitigation: Pass B 并发；Pass A 是 binary 判断，prompt 更短更快；Pass C 在输入变小后也更快。整体增幅预计 30-50%，用户可接受。

**[R2] Pass A 的 sort_key 对齐难题**：虚构世界（Middle-earth ages、Fate 圣杯战争编号）LLM 给出的 sort_key 可能不自洽。→ Mitigation: 已有 `sort_key_inferred: false` 机制 + 交互式 review UI，作者可校正。只要求"本世界内单调递增"不要求跨世界可比。

**[R3] `timeline.md` evolve 冲突**：作者编辑后再 evolve 可能产生冲突。→ Mitigation: D5 选定"保留作者版本 + 日志 warn"，冲突不会丢数据。

**[R4] Pass C 的输入计算**：Pass C 需要"Pass A 未消费的 chunks"。严格实现是 chunk-level diff，复杂度不低。→ Mitigation: 简化为"把全部 history chunks 交给 Pass C，靠 prompt 让 LLM 自觉避开已经是 timeline 的事件"。生产实践中 overlap 可接受（review 阶段会去重）。

**[R5] `.skill` 导出包格式变更**：Phase 1 LLM 读 chronicle 的路径从 `world/chronicle/timeline/` 改为 `world/history/timeline.md`，已导出的 skill 包需要重新 export。→ Mitigation: 用户已接受，proposal 明确说明。

**[R6] 测试 fixture 大量重写**：`tests/integration/fixtures/` 和多处写死路径的测试会全部挂。→ Mitigation: 计入 tasks.md 的工作量，分文件逐一修复。

**[R7] UI 组件对路径的假设**：`world-distill-panel.tsx` 和 `world-distill-review.tsx` 在展示维度统计和路径预览时可能硬编码 `entries/`。→ Mitigation: 代码地图里已列出这两个文件，tasks 显式覆盖。

**[R8] `_` 前缀约定和 macOS 隐藏文件习惯冲突**：macOS 用户习惯 `.DS_Store` 是 dot 前缀，`_` 前缀可能让人困惑。→ 权衡：`.` 前缀会被 git 和 glob 默认忽略，`_` 前缀仍然可见——作者视图文件就是应该可见的。接受这个小认知成本。

## Migration Plan

不写迁移代码。步骤：
1. 实现完成后，用户手动跑 `rm -rf ~/.soulkiller/worlds/<old-world-name>` 删除现存测试 world
2. 跑 `/world create <name>` 重新生成

已导出的 `.skill` 包需要用户重新 `/export` 才能在新 Phase 1 逻辑下工作。

## Open Questions

**[Q1] Pass A 的 "列穷尽" 是否会导致 timeline 过长？**  
一个维基条目可能包含几十个时间锚点。timeline.md 如果有 100+ 条，runtime 注入会占用大量 token。是否需要 priority 截断？  
**暂定方案**：Pass A 的 prompt 要求 LLM 给每个条目打 importance 分数（high/medium/low），runtime 注入时 always 装配阶段按 importance + token budget 截断。作者在 `timeline.md` 里看到的是全集，runtime 按需裁剪。

**[Q2] `_index.md` 的内容深度**  
纯清单（表格列 name + 一行）？还是包含 entry 摘要？前者轻量但信息少，后者重复 entry 内容但 review 时更有用。  
**暂定方案**：前者（表格 + 一行 + priority + mode），保持 `_index.md` 是"导航页"而非"压缩副本"。

**[Q3] evolve 模式下 Pass A/B/C 的语义**  
evolve 是增量，但 Pass A 是全量列表。evolve 时是否跑 Pass A？  
**暂定方案**：evolve 跑完整三 Pass，但 Pass A 的输出在写入时走 D5 的合并策略（保留作者版本 + 增量插入），Pass B 只对 Pass A **新产生的** 条目扩写。

这三个问题的暂定方案可以在 apply 阶段按需细化，不阻塞 propose。
