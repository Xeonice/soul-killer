## Why

当前 `/create` 命令一次只能创建一个 Soul，每个 Soul 需要经历完整的向导→搜索→确认→蒸馏流程（约 50-100s）。当用户需要批量创建多个角色时，必须重复执行多次，总耗时线性增长。通过扩展现有 `/create` 命令支持批量输入和并行执行，可以将 N 个角色的创建时间压缩到接近单个角色的耗时。

## What Changes

- 扩展 `/create` 向导流程，在收集首个 Soul 的 name + description 后，增加 `soul-list` 步骤，允许用户继续添加更多 Soul 或直接继续
- 输入单个 Soul 时走现有完整流程（向后兼容），输入多个时进入 batch 管道
- 批量模式下跳过手动 tags 输入，由 distill agent 自动推断
- 批量模式下 data-sources 统一选择（所有 Soul 共享同一数据源配置）
- 新增并行执行管道：每个 Soul 独立走 capture → distill 全流程，最多 3 并发（流水线式，capture 完即开始 distill，不等其他 Soul）
- 新增批量紧凑进度视图（每个 Soul 一行进度条），支持 ↑↓ 选择 + Enter 展开单个 Soul 详细视图（复用现有 `SoulkillerProtocolPanel`），Esc 返回紧凑视图
- 批量模式下跳过逐个 search-confirm，capture 完自动进入 distill
- 新增批量结果汇总视图，展示每个 Soul 的成功/失败状态，支持重试失败的 Soul 或跳过

## Capabilities

### New Capabilities

- `batch-create-pipeline`: 并行执行管道，管理多个 Soul 的 capture → distill 流水线，包含并发控制（max 3）、进度事件聚合、失败隔离与重试
- `batch-progress-view`: 批量进度 UI 组件，包含紧凑列表视图和详细展开视图的切换交互，以及最终汇总视图

### Modified Capabilities

- `create-command`: 向导流程扩展——新增 soul-list 步骤作为单/多分流点，批量模式下跳过 tags 手动输入和 search-confirm，data-sources 统一选择

## Impact

- **CLI 组件**: `src/cli/commands/create.tsx` — 状态机扩展，新增 batch 相关步骤
- **动画/UI**: `src/cli/animation/` — 新增 `BatchProtocolPanel` 紧凑视图组件
- **Agent**: `src/agent/soul-capture-agent.ts` — 接口不变，但会被并发调用
- **Distill**: `src/distill/distill-agent.ts` — 接口不变，但会被并发调用
- **LLM 并发**: 峰值 3 个并发 LLM 请求（3 个 agent 各自调用 generateText），需注意 OpenRouter rate limit
- **i18n**: 新增批量相关的翻译 key
