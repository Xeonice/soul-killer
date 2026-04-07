## Why

WorldDistiller 的所有 LLM 调用（classify、extract、review、distillFromCache）完全没有接入 AgentLogger，导致世界蒸馏过程无法事后排查。Soul 侧（distill-agent.ts、extractor.ts）已有完整的日志记录，World 侧是唯一的日志盲区。当用户遇到蒸馏结果质量问题或静默失败时，没有任何诊断数据可用。

## What Changes

- WorldDistiller 的 `distill()` 和 `distillFromCache()` 方法接收可选 `agentLog?: AgentLogger` 参数
- `classifyChunks` 每个 batch 的 generateText 调用记录 phase/batch/耗时/输出长度
- `extractEntries` 每个维度的 generateText 调用记录 phase/batch/耗时/输出长度
- `distillFromCache` 每个维度的 generateText 调用记录同上
- `reviewEntries` 的 generateText 调用记录 phase/耗时
- 所有 `catch {}` 静默吞异常处改为记录错误到日志（仍不抛出）
- 4 处调用方（world-distill.tsx 3 处 + world-create-wizard.tsx 1 处）创建 AgentLogger 并传入
- `distillEnd` 记录适配 World 的结果摘要（entries 数、维度覆盖、总耗时）

## Capabilities

### New Capabilities

（无新 capability）

### Modified Capabilities

- `world-distill`: WorldDistiller 的 distill/distillFromCache 方法新增 agentLog 参数，所有 LLM 调用接入 AgentLogger 日志记录

## Impact

- `src/world/distill.ts` — WorldDistiller 类，主要改动文件
- `src/cli/commands/world-distill.tsx` — 3 处 WorldDistiller 调用方，需创建并传入 AgentLogger
- `src/cli/commands/world-create-wizard.tsx` — 1 处调用方，同上
- `src/utils/agent-logger.ts` — 可能需要微调 distillEnd 以适配 World 结果格式
- 不涉及 breaking change，agentLog 为可选参数
