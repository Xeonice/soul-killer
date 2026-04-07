## Context

当前 `/create` 命令是严格串行的状态机：type-select → name → description → tags → confirm → data-sources → capturing → search-confirm → distilling → done。每个 Soul 需要 50-100s，N 个 Soul 线性累加。

现有架构的关键约束：
- `CreateCommand` 是单一 React 组件，用 `useState` + `useInput` 驱动状态转换
- `captureSoul()` 和 `distillSoul()` 是纯 async 函数，接受 `onProgress` 回调——天然支持并发调用
- ink 的 `useInput` 是全局广播模式，`interactiveMode` 标志用于避免输入冲突
- `SoulkillerProtocolPanel` 是无状态渲染组件，接受 props 展示进度

## Goals / Non-Goals

**Goals:**
- 扩展 `/create` 向导支持一次输入多个 Soul（name + description）
- 输入 1 个 Soul 时完全走现有流程，零感知差异
- 多 Soul 时并行执行 capture → distill 全流程，最多 3 并发
- 流水线式执行：单个 Soul capture 完立即开始 distill，不等其他 Soul
- 提供紧凑进度视图（每 Soul 一行）+ 可展开详细视图的交互
- 失败隔离：单个 Soul 失败不影响其他，支持重试

**Non-Goals:**
- 不改变 `captureSoul` / `distillSoul` 的内部实现或接口
- 不支持批量模式下的手动 tags 输入（由 distill 自动推断）
- 不支持批量模式下逐个 Soul 配置不同的 data-sources
- 不支持超过合理数量的并行（固定 max 3）
- 不实现批量模式的 E2E 测试（留给后续迭代）

## Decisions

### 1. 向导流程：soul-list 步骤作为分流点

**决策**：在 name + description 之后插入 `soul-list` 步骤。用户可以选择"添加更多"或"继续"。

**替代方案**：
- A. 新增独立 `/create-batch` 命令 — 拒绝，因为增加认知负担，且两个命令的代码大量重复
- B. 先问"创建几个？"再循环收集 — 拒绝，用户可能不确定数量，动态添加更自然

**实现要点**：
- `soul-list` 步骤维护一个 `SoulInput[]` 数组（`{ name, description }`）
- 选"添加"时回到 `name` 步骤，完成后追加到数组并返回 `soul-list`
- 选"继续"时：`length === 1` 走单 Soul 现有流程，`length > 1` 走 batch 管道
- 提供"移除最后一个"选项

### 2. 并行管道：流水线式 + 并发池

**决策**：使用并发池（concurrency pool）模式，每个 Soul 是一个独立 task，走完 capture → distill 全流程。池大小固定 3。

**替代方案**：
- A. 先全部 capture，再全部 distill（分阶段） — 拒绝，浪费等待时间，总耗时更长
- B. 无限并发 — 拒绝，会触发 OpenRouter rate limit

**实现要点**：
```
BatchPipeline {
  queue: SoulInput[]           // 待处理
  active: Map<name, Promise>   // 正在执行（max 3）
  results: Map<name, Result>   // 已完成

  每个 task 的生命周期:
  pending → capturing → distilling → done | failed
}
```

新增 `src/agent/batch-pipeline.ts`，纯逻辑模块，不含 UI。通过 `onProgress(name, event)` 回调向 UI 层汇报各 Soul 的进度。

### 3. 进度视图：紧凑/详细双模式

**决策**：新增 `BatchProtocolPanel` 组件，默认紧凑视图，Enter 展开选中 Soul 的详细视图（复用 `SoulkillerProtocolPanel`），Esc 返回。

**替代方案**：
- A. 始终详细视图 — 拒绝，3 个 Soul 同时展开信息量过大
- B. 只有紧凑视图 — 拒绝，用户无法审查单个 Soul 的搜索过程

**实现要点**：
- `BatchProtocolPanel` 内部状态：`viewMode: 'compact' | 'detail'`，`selectedIndex: number`
- 紧凑视图：每 Soul 一行，显示 name、当前阶段、进度条、fragment 数
- 详细视图：渲染 `SoulkillerProtocolPanel` + `DistillProgressPanel`，传入选中 Soul 的 props
- ↑↓ 切换选中项，Enter 展开，Esc 返回
- `useInput` 仅在此组件内处理，不与外部冲突（已在 `interactiveMode` 保护下）

### 4. 批量模式跳过 search-confirm

**决策**：批量模式下 capture 完成后自动进入 distill，不弹出 search-confirm。

**理由**：批量创建追求效率，逐个确认会阻塞流水线。失败或异常在最终汇总时统一处理。

### 5. 失败处理：隔离 + 汇总 + 重试

**决策**：每个 Soul 独立 try-catch，失败的记录错误信息，不影响其他。全部完成后在 `batch-summary` 视图中展示结果，提供重试选项。

**重试机制**：选择"重试失败的"后，将失败的 Soul 重新放入并发池执行。

### 6. 状态机扩展

新增 CreateStep：
- `soul-list` — Soul 列表管理（添加/移除/继续）
- `batch-capturing` — 并行执行中（紧凑进度视图）
- `batch-summary` — 结果汇总

不新增 `batch-distilling` 步骤——因为 distill 在流水线中自动执行，UI 上仍在 `batch-capturing` 视图中展示（distilling 阶段体现为该 Soul 行的状态变化）。

## Risks / Trade-offs

**[OpenRouter Rate Limit]** → 3 并发 agent 各自有 5-15 步 LLM 调用，峰值 3 并发请求。缓解：固定并发上限 3；如果遇到 429 错误，在 pipeline 层做指数退避重试。

**[ink 渲染性能]** → 3 个 agent 同时发 progress 事件，高频 setState 可能导致渲染闪烁。缓解：在 `BatchProtocolPanel` 中对进度更新做节流（throttle），紧凑视图下非选中项只更新阶段文本，不渲染 tool call 细节。

**[内存]** → 3 个 agent 同时运行，每个持有各自的 chunks 数组。单个 Soul 通常 10-50 chunks，3 个 = 30-150 chunks，内存影响可忽略。

**[向导复杂度增加]** → `CreateCommand` 已有 12 个步骤。新增 3 个步骤后达到 15 个，状态管理复杂度上升。缓解：batch 相关状态抽取为独立的 `useBatchState` hook，与单 Soul 状态隔离。
