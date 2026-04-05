## Why

当前 Soul Capture Agent 是一个固定 4 步管线（确定性搜索 → LLM 分类 → 策略深搜 → 相关性过滤），搜索关键词和策略路由都是硬编码的。LLM 只在分类和过滤两个点做判断，无法根据中间结果自适应调整搜索方向。新增目标类型需要手动添加策略代码。将其重构为 AI SDK v6 的 ToolLoopAgent 驱动的自主 agent loop，让 LLM 自主决定搜索什么、什么时候信息足够、什么时候停止。

## What Changes

- 用 `ToolLoopAgent` 替代 `captureSoul()` 中的手动 4 步管线
- 将现有的 `executeSearch`、`executeWikipedia`、`extractPageContent` 包装为 AI SDK `tool()` 供 LLM 自主调用
- 新增 `reportFindings` 终止 tool（无 execute），LLM 调用它时循环自动停止
- 移除硬编码的分类→策略映射（`strategies/` 目录），分类由 LLM 在搜索过程中自然完成并通过 reportFindings 返回
- 移除独立的 `filterRelevantExtractions()` 步骤，LLM 在搜索过程中自行判断相关性
- 通过 `onStepFinish` 回调映射到现有的 `CaptureProgress` 事件系统，保持 UI 兼容
- 通过 `prepareStep` 实现 doom loop 检测和最后一步强制总结
- `stopWhen: [stepCountIs(30), hasToolCall('reportFindings')]`
- **BREAKING**: `CaptureProgress` 事件的发送时机和频率会变化（不再有固定的 phase 顺序）

## Capabilities

### New Capabilities

- `agent-tool-loop`: 基于 AI SDK v6 ToolLoopAgent 的自主搜索循环，包含 system prompt 设计、tool 定义、stopWhen/prepareStep 配置

### Modified Capabilities

- `soul-capture-agent`: 整体架构从固定管线变为 LLM 驱动循环；移除分类→策略映射、独立过滤步骤；保留 CaptureResult 接口和 CaptureProgress 事件兼容性

## Impact

- `src/agent/soul-capture-agent.ts` — 重写核心逻辑
- `src/agent/strategies/` — 整个目录移除（digital-construct.ts, public-entity.ts, historical-record.ts, types.ts, index.ts）
- `src/agent/tools/search-factory.ts` — 改为导出 AI SDK tool() 定义而非手动 executor
- `src/cli/commands/create.tsx` — CaptureProgress 消费逻辑可能需要适配
- `src/cli/components/soulkiller-protocol-panel.tsx` — Progress 展示逻辑可能需要适配
- `package.json` — 确认 `ai` 包版本 ≥ 6.0.34（支持 ToolLoopAgent）
- 测试：`tests/integration/` 中的 agent 相关测试需要更新
