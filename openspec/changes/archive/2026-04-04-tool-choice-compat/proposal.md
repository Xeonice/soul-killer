## Why

当前 agent 硬编码 `toolChoice: 'required'` 和 `prepareStep` 中的 `activeTools` 阶段控制，导致 Qwen 3.5 thinking mode（不支持 required）报错、DeepSeek 在 activeTools 限制下只跑 1 步就停。实测发现 `toolChoice: 'auto'` 在所有模型上都能正常工作，且 LLM 在 prompt 引导下会主动调用工具。

## What Changes

- `toolChoice` 从 `'required'` 改为 `'auto'`
- 移除 `prepareStep` 中的 `activeTools` 阶段控制（所有工具始终可见）
- 保留 `prepareStep` 的 doom loop 检测和最后一步强制 reportFindings
- 更新 system prompt，加入明确的步骤顺序指令替代 `activeTools` 的阶段约束

## Capabilities

### New Capabilities

（无）

### Modified Capabilities

- `agent-tool-loop`: toolChoice 改为 auto，移除 activeTools 阶段控制，prompt 引导替代 API 层面强制

## Impact

- `src/agent/soul-capture-agent.ts` — 修改 toolChoice、prepareStep、system prompt
- 无新文件、无依赖变更
