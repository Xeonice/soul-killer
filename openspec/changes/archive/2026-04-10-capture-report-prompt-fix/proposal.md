## Why

不支持 `toolChoice: 'required'` 的模型（如 Qwen 3.6 Plus）在 capture agent 中使用 `toolChoice: 'auto'` 时，完成所有维度评估后不调用 `reportFindings` 工具，而是直接输出文本结论退出循环，导致分类退化为 UNKNOWN_ENTITY。

当前 system prompt 对 `reportFindings` 的描述只有一句 "After ALL dimensions are evaluated, call reportFindings"，对 `auto` 模式下的模型不够强。

## What Changes

- 在 soul/world capture strategy 的 system prompt 中强化 `reportFindings` 的终止约束
- 明确说明"必须通过 reportFindings 工具结束，文本输出不算完成"
- 改动只涉及 prompt 文本，不改代码逻辑

## Capabilities

### New Capabilities

（无）

### Modified Capabilities

- `soul-capture-agent`: system prompt 强化 reportFindings 终止约束

## Impact

- `src/agent/strategy/soul-capture-strategy.ts` — SOUL_SYSTEM_PROMPT 修改
- `src/agent/strategy/world-capture-strategy.ts` — WORLD_SYSTEM_PROMPT 修改（如有类似问题）
