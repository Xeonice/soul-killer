## Why

LLM 在 tool calling 时频繁把 `z.array()` 参数序列化为 JSON 字符串而非真正的数组，导致 zod 验证失败、circuit breaker 触发、export 流程中断。这是 AI SDK 生态已知缺陷（`z.preprocess`/`z.transform` 在 zod→JSON Schema 转换时被丢弃，模型看不到 preprocess 逻辑）。需要用 AI SDK 官方推荐的三层防御方案从根本上解决。

## What Changes

### Layer 1: `inputExamples` — 前置预防
- 给每个含 array 参数的 tool 添加 `inputExamples`，提供至少一组正确格式的完整输入样例
- 模型在生成阶段看到具体实例，比看 JSON Schema `type: "array"` 更可靠

### Layer 2: `strict: true` — 生成约束
- 对关键 tool（尤其是 export 流程中频繁出错的 `set_prose_style`、`set_story_metadata`）启用 strict mode
- Provider 端（如果支持）在生成阶段就约束输出格式

### Layer 3: `experimental_repairToolCall` — 兜底修复
- 在所有 `ToolLoopAgent` 构造点统一挂载一个共享的 repair 回调
- 本地修复逻辑：检测 string 类型的 array 参数 → JSON.parse / 正则清理 → 返回修复后的 tool call
- 不调用额外 LLM，零延迟零成本

### 清理
- 回滚之前加的 `z.preprocess` — 它在这个体系里多余（JSON Schema 转换丢弃 preprocess，实际防护不确定）
- 回滚 `src/infra/utils/zod-preprocess.ts` 工具模块

## Capabilities

### New Capabilities
- `tool-call-defense`: 三层防御体系 — inputExamples（预防）+ strict mode（约束）+ repairToolCall（兜底）

### Modified Capabilities
（无修改现有 spec）

## Impact

- **src/export/agent/story-setup.ts** — 添加 inputExamples + strict，回滚 z.preprocess
- **src/export/agent/planning.ts** — 添加 inputExamples，回滚 z.preprocess
- **src/export/agent/character.ts** — 检查并添加 inputExamples（如有 array 参数）
- **src/infra/agent/tools/supplement-search.ts** — 添加 inputExamples，回滚 z.preprocess
- **src/infra/agent/tools/report-findings.ts** — 添加 inputExamples，回滚 z.preprocess
- **src/soul/distill/distill-agent.ts** — 添加 inputExamples，回滚 z.preprocess
- **src/export/agent/agent-loop.ts** 或各 ToolLoopAgent 构造点 — 挂载 repairToolCall
- **src/infra/utils/zod-preprocess.ts** — 删除
