## Context

Capture agent 的 ToolLoopAgent 对不支持 `toolChoice: 'required'` 的模型降级为 `'auto'`。`auto` 模式下模型可以选择不调用工具就结束循环（AI SDK 的 do-while 条件要求有 tool call 才继续）。当前 prompt 对 `reportFindings` 的引导不够强。

## Goals / Non-Goals

**Goals:**
- 强化 system prompt，让 `toolChoice: 'auto'` 的模型也能可靠调用 `reportFindings`

**Non-Goals:**
- 不改代码逻辑、不改 fallback 行为、不改 tool schema

## Decisions

### 在 SOUL_SYSTEM_PROMPT 和 WORLD_SYSTEM_PROMPT 的 Rules 部分添加终止约束

添加两条规则：
1. "Your LAST tool call MUST be reportFindings. Never end without it."
2. "Text output alone does NOT count as completion — only a reportFindings tool call finishes the task."

### 在 buildSystemPrompt 的结尾添加显式提醒

在维度覆盖要求后追加：
"When all dimensions are covered, immediately call reportFindings. Do NOT output a text summary — call the tool."
