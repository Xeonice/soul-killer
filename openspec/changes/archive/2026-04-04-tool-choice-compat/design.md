## Context

实测 OpenRouter 上各模型对 tool_choice 的支持情况：
- `auto`: 所有模型都支持
- `required`: Qwen thinking mode 不支持（报 400）
- `{ type: 'tool', toolName: 'xxx' }`: Qwen thinking mode 不支持
- `activeTools` 动态限制: DeepSeek 行为异常（循环提前终止）

## Goals / Non-Goals

**Goals:**
- 统一用 `toolChoice: 'auto'`，兼容所有 tool calling 模型
- 移除 `activeTools` 阶段控制，消除模型兼容性问题
- 通过 prompt 引导实现等效的阶段行为
- 保留 doom loop 检测和最后一步兜底

**Non-Goals:**
- 不做模型能力映射表（统一 auto 后不需要）
- 不改变工具定义和维度系统

## Decisions

### 1. toolChoice 统一为 'auto'

所有模型都支持，LLM 自行决定是否调用工具。通过 prompt 引导确保 LLM 每步都优先调用工具。

### 2. 移除 activeTools 阶段控制

prepareStep 不再返回 activeTools。所有 5 个工具每步都可见。阶段行为通过 prompt 引导：
- "Steps 1-2: 使用 search 工具搜索"
- "Step 3: 调用 planSearch"
- "Steps 4+: 按计划搜索，定期 checkCoverage"

### 3. 保留 prepareStep 的两个功能

- doom loop 检测（连续 3 次相同调用 → 最后一步不变）
- 最后一步（step >= 29）强制 reportFindings — 这里仍用 `toolChoice: { type: 'tool', toolName: 'reportFindings' }`。如果模型不支持，最坏情况是 LLM 生成文本 → 循环结束 → fallback UNKNOWN_ENTITY，可接受

### 4. prompt 补充阶段引导

在 system prompt Workflow 部分加入明确指令：
```
IMPORTANT: Always use tools — do not generate plain text responses.
Each step should result in a tool call (search, planSearch, 
checkCoverage, extractPage, or reportFindings).
```

## Risks / Trade-offs

**[LLM 可能提前生成文本]** auto 模式下 LLM 可能不调 tool → 循环意外终止 → prompt 引导 + checkCoverage 兜底可降低概率

**[最后一步 forced toolChoice 可能失败]** 个别模型不支持 forced → fallback 到 UNKNOWN_ENTITY → 可接受，不是常见路径
