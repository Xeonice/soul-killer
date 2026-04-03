## Context

当前 `captureSoul()` 的 Round 1 使用 AI SDK 的 `generateText` + tools 让 LLM 自由调用 search/wikipedia。LLM 通过 OpenRouter 中转，工具调用循环最多 6 次迭代。实际观察到：(1) 第一次迭代经常返回空文本（finishReason: stop, responseMessageCount: 0）；(2) LLM 有时不调用工具直接回答；(3) LLM 输出格式不一致（Markdown vs JSON vs 纯文本）。

Round 2（模板搜索）和后续的相关性过滤已经是程序驱动的，运行稳定。只有 Round 1 存在问题。

## Goals / Non-Goals

**Goals:**
- Round 1 搜索行为 100% 确定性：相同输入 → 相同搜索请求
- LLM 只做一次调用：分析搜索结果 → 输出 JSON，不驱动搜索
- 消除空文本/重试问题
- 保持 Protocol Panel 的实时搜索进度展示

**Non-Goals:**
- 修改 Round 2 模板搜索逻辑
- 修改相关性过滤逻辑
- 修改 Protocol Panel 的视觉设计

## Decisions

### D1: Round 1 改为三步流程

```
Step 1: 程序化搜索（确定性）
  ├─ Tavily: "{name}"
  ├─ Tavily: "{name} {hint}" (如果有 hint)
  ├─ Wikipedia 中文: name
  └─ Wikipedia 英文: name (或 hint 中的英文名)

Step 2: LLM 单次分析（一次 generateText，无 tools）
  输入: 搜索结果摘要
  输出: JSON { classification, english_name, origin, summary }

Step 3: 如果 classification 非 UNKNOWN → 进入 Round 2
```

**理由**: 搜索由程序控制，确定性可复现；LLM 只负责理解和分类，单次调用无循环，消除空文本问题。

### D2: 搜索策略

初始搜索执行 2-4 次查询（根据是否有 hint）：

| 条件 | 查询 |
|------|------|
| 总是执行 | Tavily: `{name}` |
| 有 hint | Tavily: `{name} {hint}` |
| 总是执行 | Wikipedia 中文: `{name}` |
| 总是执行 | Wikipedia 英文: `{name}` |

如果名字包含中文且 hint 中有英文关键词，额外搜英文名。

**理由**: 覆盖中英文搜索源，hint 提供消歧义能力。查询数量固定，耗时可预测。

### D3: LLM 分析 prompt

将搜索结果截取前 N 字符（避免超 token 上限），拼成上下文：

```
你是 Soulkiller Protocol。根据以下搜索结果，分析目标 "{name}" 的身份。
{hint 信息}

搜索结果：
[1] {source} - {url}
{content 截取}

[2] ...

输出 JSON（无 markdown、无代码块）：
{"classification": "...", "english_name": "...", "origin": "...", "summary": "..."}
```

**理由**: 所有信息一次给到，模型只做分析不做决策，output 格式与现有 `parseIdentificationJSON` 兼容。

### D4: 保持 ToolCallDisplay 兼容

现有 Protocol Panel 展示 tool calls 列表（tool name + query + status）。程序化搜索也 emit 相同的 `tool_call` / `tool_result` 进度事件，Panel 无需修改。

**理由**: 从用户视角，搜索进度展示不变——仍然看到"🔍 大卫·马丁内斯 → 5 results ✓"。只是驱动方不再是 LLM。

### D5: 错误处理

单个搜索源失败不阻塞整体流程：
- Tavily 失败 → 跳过，继续 Wikipedia
- Wikipedia 失败 → 跳过
- 全部失败 → 直接进入 LLM 分析（可能分类为 UNKNOWN）
- LLM 分析返回空/非 JSON → 重试一次，仍失败则 UNKNOWN

## Risks / Trade-offs

**[搜索覆盖面降低]** LLM 自由搜索可能构造出更灵活的查询 → 用 hint + 固定多查询补偿。实测 LLM 构造的查询也经常不理想。

**[LLM 分析上下文过长]** 多次搜索结果拼接可能超 token → 每条结果截取前 500 字符，总上下文控制在 ~4000 字符。
