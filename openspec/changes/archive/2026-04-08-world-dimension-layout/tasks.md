## 1. 清理和准备

- [x] 1.1 删除本地 `~/.soulkiller/worlds/` 下所有现存测试 world（两个），避免后续跑代码时触发旧布局路径
- [x] 1.2 在 `src/world/entry.ts` 顶部规划新布局的常量和路径解析函数签名

## 2. 路径解析集中化（src/world/entry.ts）

- [x] 2.1 新增 `getDimensionDir(worldName, dimension): string` 返回 `<worldDir>/<dimension>`
- [x] 2.2 新增 `getEntryPath(worldName, meta): string` 根据 `meta.dimension` + `meta.name` 计算完整路径；dimension 缺失时走 `inferDimensionFromScope` 兜底
- [x] 2.3 新增 `getHistoryEventsDir(worldName): string` 返回 `<worldDir>/history/events`
- [x] 2.4 新增 `getHistoryTimelinePath(worldName): string` 返回 `<worldDir>/history/timeline.md`
- [x] 2.5 把 `inferDimensionFromScope` 从 `distill.ts` 提升到 `entry.ts` 供其他模块共用，保留原有映射规则

## 3. Entry CRUD 重写（src/world/entry.ts）

- [x] 3.1 重写 `addEntry`：调用 `getEntryPath` 得到目标路径，自动创建维度子目录
- [x] 3.2 重写 `loadAllEntries`：遍历所有维度子目录（`geography/`、`history/`、…），跳过 `_` 前缀文件、`history/events/` 子目录、`history/timeline.md` 单文件
- [x] 3.3 重写 `removeEntry`、`updateEntry` 使用新路径解析
- [x] 3.4 `EntryMeta` 类型中将 `dimension` 从可选改为必需（或在 `addEntry` 入口强制兜底），更新相关类型和 JSDoc
- [x] 3.5 调整 `parseEntryMeta` / `normalizeMeta` 保留新增的 `importance` 字段（timeline 段落元数据用）

## 4. Chronicle 模块重写（src/world/chronicle.ts）

- [x] 4.1 删除 `chronicleDir()`、`loadAllOfKind()` 等基于 `chronicle/<kind>/` 的路径逻辑
- [x] 4.2 实现 `parseTimelineFile(filePath): WorldEntry[]`：读 `history/timeline.md`，按 `## ` 段落切分，每段解析出 `name`、`sort_key`、`display_time`、`event_ref`、`importance`、`one_line` body
- [x] 4.3 实现 `writeTimelineFile(worldName, entries)`：将 WorldEntry 数组序列化为单文件（带 frontmatter `type: chronicle-timeline`，按 sort_key 升序）
- [x] 4.4 实现 `mergeIntoTimelineFile(worldName, newEntries)`：按 sort_key 插入新条目；冲突 stem 保留作者版本并记录 warn 到 agentLog
- [x] 4.5 重写 `loadChronicleTimeline(worldName)` 使用 `parseTimelineFile`，文件不存在返回 `[]`
- [x] 4.6 重写 `loadChronicleEvents(worldName)` 枚举 `history/events/*.md`
- [x] 4.7 重写 `addChronicleEntry(worldName, kind, meta, content)`：timeline 走 merge，events 走直接写入 `history/events/<name>.md`
- [x] 4.8 重写 `removeChronicleEntry`
- [x] 4.9 保留 `sortByChronicle` 工具函数不变

## 5. History 三 Pass distill（src/world/distill.ts）

- [x] 5.1 删除 `buildChronicleGuidance()` 函数
- [x] 5.2 删除 `expandChroniclePair()` 函数
- [x] 5.3 在 `extractEntries` 和 `distillFromCache` 中移除 `isHistoryDim` 的 chronicle 分支逻辑
- [x] 5.4 新增 `runHistoryThreePass(worldName, chunks, model, agentLog): Promise<GeneratedEntry[]>` 作为 history 维度的独立入口
- [x] 5.5 Pass A：实现 timeline 列表提取的 prompt 和 JSON 解析；输出中每个条目包含 `name`、`display_time`、`sort_key`、`one_line`、`source_excerpt`、`sort_key_inferred`、`importance`
- [x] 5.6 Pass B：对 Pass A 每个条目并发调用 LLM（CONCURRENCY=5）扩写 5-10 句 detail；每个条目生成一个 `chronicleType: 'events'` 的 `GeneratedEntry`
- [x] 5.7 Pass C：用"论文模式"的 prompt 提取非事件性 history 内容，告知 LLM "Pass A 已经处理所有时点事件"；产出普通 `GeneratedEntry`（dimension: history，不带 chronicleType）
- [x] 5.8 Pass A 的产物统一构造为 `chronicleType: 'timeline'` 的 `GeneratedEntry`，body 为 `one_line`
- [x] 5.9 在 `extractEntries` 和 `distillFromCache` 的维度分发里，把 history 维度路由到 `runHistoryThreePass`；其他维度继续走现有 `extract` 逻辑
- [x] 5.10 AgentLogger 集成：三 Pass 每个都记录 start/done 和耗时，错误路径记录 `toolInternal`

## 6. writeEntries 分流重写（src/world/distill.ts）

- [x] 6.1 重写 `writeEntries(worldName, entries)` 按 `chronicleType` 分流：
  - `chronicleType: 'timeline'` → 调用 `mergeIntoTimelineFile` 合并到单文件
  - `chronicleType: 'events'` → 调用 `addChronicleEntry(worldName, 'events', ...)`
  - 其他 → 调用 `addEntry` 写入 `<dimension>/<name>.md`
- [x] 6.2 writeEntries 完成后调用 `refreshDimensionIndexes(worldName)` 刷新所有维度的 `_index.md`
- [x] 6.3 `manifest.entry_count` 的计算仍用 `loadAllEntries(worldName).length`（新 loader 已跳过 events/timeline）

## 7. `_index.md` 生成（src/world/entry.ts 或新文件）

- [x] 7.1 实现 `refreshDimensionIndexes(worldName)`：遍历所有存在的维度子目录，为每个非空维度生成 `_index.md`
- [x] 7.2 `_index.md` 的 frontmatter 包含 `type: dimension-index`、`dimension: <name>`、`entry_count: <n>`
- [x] 7.3 `_index.md` 的 body 是 markdown 表格，列：Entry（链接）、Priority、Mode、一句话摘要（取 content 首句或前 80 字符）
- [x] 7.4 空维度跳过（不生成空文件）
- [x] 7.5 在 `evolve()` 的 `finalizeEvolve` 完成后也调用 `refreshDimensionIndexes`（通过 writeEntries → refreshDimensionIndexes 链路）

## 8. 搜索 query 微调（src/agent/strategy/world-dimensions.ts）

- [x] 8.1 在 `WORLD_DIMENSION_TEMPLATES` 的 `history` 维度的 `queries` 数组末尾追加 `'{localName} 年表'` 和 `'timeline of {name}'`
- [ ] 8.2 （可选）在 `src/agent/search/title-filter.ts` 或 search backend 层加 title/url 含 `timeline of|年表|chronology` 关键词的结果排序提前（暂缓：可选优化，不阻塞核心流程）

## 9. ContextAssembler 适配（src/world/context-assembler.ts）

- [x] 9.1 验证 `loadAllEntries` 调用不需要改签名——只是实现细节换了
- [x] 9.2 验证 `loadChronicleTimeline` 返回结构兼容（仍是 `WorldEntry[]`）
- [x] 9.3 验证 `loadChronicleEvents` 返回结构兼容
- [x] 9.4 验证第 2 步"chronicle 底色聚合"在新版 timeline 为空时正确降级（不渲染空标题）
- [x] 9.5 验证 runtime 装配逻辑（scope/mode/priority 过滤、token budget、注入顺序）零改动

## 10. Export 适配（src/export/）

- [x] 10.1 `packager.ts`：调整打包目录映射，把 `worlds/<name>/<dimension>/*.md` 复制到 `.skill/world/<dimension>/*.md`；`history/timeline.md` 复制到 `.skill/world/history/timeline.md`；`history/events/` 复制到 `.skill/world/history/events/`
- [x] 10.2 `packager.ts`：打包时跳过所有 `_` 前缀文件（`_index.md`、`_overview.md`）
- [x] 10.3 `skill-template.ts`：Phase 1 LLM 的 prompt 里读取 chronicle 路径从 `world/chronicle/timeline/` 改为 `world/history/timeline.md`（解析单文件）、`world/chronicle/events/` 改为 `world/history/events/`
- [x] 10.4 验证 `story-spec.ts` 中如有涉及 chronicle 路径的地方一并更新（grep 未发现 chronicle 路径引用）

## 11. UI 组件更新（src/cli/components/）

- [x] 11.1 `world-distill-panel.tsx`：更新维度统计的路径预览展示（grep 未发现硬编码路径）
- [x] 11.2 `world-distill-review.tsx`：更新 review UI 中 entry 路径的展示格式（grep 未发现硬编码路径）
- [x] 11.3 检查 `world-create-wizard.tsx`、`world.tsx`、`world-bind.tsx`、`world-distill.tsx` 是否有硬编码路径，一并更新（grep 未发现）

## 12. 测试修复（tests/）

- [x] 12.1 `tests/unit/world-entry.test.ts`：通过——dimension subdirectory 路径解析无需断言修改
- [x] 12.2 `tests/unit/world-chronicle.test.ts`：替换 `chronicleDir` 测试为 `getHistoryEventsDir`/`getHistoryTimelinePath`
- [x] 12.3 `tests/unit/world-distill-extract.test.ts`：替换两个旧 chronicle pair 测试为三 Pass mock 测试
- [x] 12.4 `tests/integration/` 中涉及 world 的 fixture（无显著影响，集成测试通过 unit 已覆盖）
- [ ] 12.5 `tests/e2e/scenarios.test.ts` 中涉及 world create/distill 的场景更新（暂缓——E2E 需要手动验证 + 修 e2e harness 写死路径）
- [x] 12.6 修复 `tests/unit/world-manifest.test.ts` 写死 `entries/` 的断言、`tests/unit/export.test.ts` 的 chronicle 路径文本断言、`tests/unit/world-dimensions.test.ts` 的 query 数量 3-5 → 3-7、`tests/unit/export-tools.test.ts` 的 fixture 改为新布局
- [ ] 12.7 为新增能力补单元测试（暂缓——现有 `world-distill-extract` 已覆盖三 Pass 主路径，可后续补 _index/合并策略的细化测试）

## 13. 端到端验证

- [x] 13.1 运行 `bun run build` 确认 TypeScript 无错误（已通过）
- [x] 13.2 运行 `bun run test` 通过全部单元测试（595/595 全绿）
- [ ] 13.3 运行 `bun run test:integration` 通过集成测试（需要 LLM API key，暂缓）
- [ ] 13.4 手动跑 `/world create 三国` 完整流程，确认目录结构符合新布局
- [ ] 13.5 手动检查生成的 `history/timeline.md` 内容质量：事件条目数 ≥ 5、每条有 sort_key 和 display_time
- [ ] 13.6 手动检查 `history/events/*.md` 与 timeline.md 段落的 `> ref:` 能对上
- [ ] 13.7 手动检查各维度 `_index.md` 表格格式正确
- [ ] 13.8 手动绑定 soul 做一次对话，验证 chronicle 底色块正常注入（"## 编年史" 段落出现在 system prompt 中）
- [ ] 13.9 手动 `/export` 打包，解压 `.skill` 归档确认 `world/history/timeline.md` 和 `world/history/events/` 存在
- [ ] 13.10 手动加载导出的 skill，确认 Phase 1 能正常读取 chronicle 数据
