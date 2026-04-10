## Why

Capture agent 的 step cap 公式 `dimCount * 2 + 5` 对 7 维度只给 19 步，导致：
1. 模型跑完 evaluate/supplement 循环后没有剩余步数调用 `reportFindings`
2. 分类退化为 UNKNOWN_ENTITY
3. 对不支持 `toolChoice: 'required'` 的模型（如 Qwen 3.6 Plus），`prepareStep` 无法强制 reportFindings，问题更严重

实际运行中每个维度平均需要 3 步（evaluate + 1-2 次 supplement），加上 reportFindings 和重试余量，30 步是合理的基线。

## What Changes

- 修改 capture-agent 的 `maxSteps` 公式，保证普通角色至少 30 步
- 在 `prepareStep` 的 fallback 分支（不支持 `toolChoice: 'required'` 的模型）中通过 prompt 引导模型调用 reportFindings

## Capabilities

### New Capabilities

（无）

### Modified Capabilities

- `soul-capture-agent`: maxSteps 公式调整 + prepareStep prompt 引导

## Impact

- `src/agent/capture-agent.ts` — maxSteps 公式 + prepareStep fallback 逻辑
