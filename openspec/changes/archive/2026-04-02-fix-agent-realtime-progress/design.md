## Context

Vercel AI SDK 的 `generateText` 带 tools 时会自动在内部执行 tool calls 直到完成，外部只能拿到最终结果。UI 需要实时看到每次 tool call，所以必须改成 manual agent loop——外部控制循环，每次 tool call 手动执行并通知 UI。

参考 AI SDK cookbook 的 manual-agent-loop 示例。

## Goals / Non-Goals

**Goals:**
- 每次 tool call（search/wikipedia）实时通知 UI
- Protocol Panel 实时显示：正在搜索什么、搜到了多少条、当前在哪个步骤
- 修复搜索工具实际执行问题
- 分类逻辑更健壮

**Non-Goals:**
- 改变搜索工具本身的实现
- 改变 Protocol Panel 的视觉设计（只改数据流）

## Decisions

### D1: Manual Agent Loop

从：
```typescript
const { text } = await generateText({ model, tools, prompt, stopWhen })
// 一次性拿到结果，中间过程不可见
```

改为：
```typescript
const messages = [{ role: 'system', content: SYSTEM_PROMPT }, { role: 'user', content: prompt }]

while (true) {
  const result = await generateText({ model, messages, tools })
  messages.push(...(await result.response).messages)

  if (await result.finishReason === 'tool-calls') {
    const toolCalls = await result.toolCalls
    for (const call of toolCalls) {
      // 通知 UI: "正在搜索: {query}"
      onProgress({ type: 'tool_call', tool: call.toolName, input: call.input })

      // 手动执行 tool
      const output = await executeTool(call)

      // 通知 UI: "搜到 N 条结果"
      onProgress({ type: 'tool_result', tool: call.toolName, resultCount: output.length })

      messages.push({ role: 'tool', content: [{ type: 'tool-result', toolCallId: call.toolCallId, toolName: call.toolName, output }] })
    }
  } else {
    // LLM 不再调用工具，循环结束
    break
  }
}
```

### D2: 进度回调类型扩展

```typescript
type CaptureProgress =
  | { type: 'phase'; phase: 'initiating' | 'searching' | 'analyzing' | 'complete' | 'unknown' }
  | { type: 'tool_call'; tool: string; query: string }
  | { type: 'tool_result'; tool: string; resultCount: number }
  | { type: 'classification'; classification: TargetClassification; origin?: string }
  | { type: 'chunks_extracted'; count: number }
```

### D3: 分类逻辑 — LLM 每步分析

不再依赖最终 JSON 输出。改为：
1. 第一次 search 返回后，让 LLM 在下一轮判断 classification
2. 从 LLM 的文本输出中提取 classification（正则匹配 `DIGITAL_CONSTRUCT` 等关键字）
3. 搜索结果直接用 web-adapter 转为 chunks，不依赖 LLM 再输出 JSON

### D4: Protocol Panel 实时数据

Panel 新增显示：
```
  ▓ extracting neural patterns...
    ▸ core identity............... ✓
    ▸ searching: "强尼银手 是谁"    ⠋   ← 实时显示搜索查询
    ▸ found 5 results              ← 搜索结果数量
    ▸ behavioral signatures....... ⠋
```

## Risks / Trade-offs

### R1: 更多 LLM 调用
- **风险**: manual loop 每轮都是一次完整的 LLM 调用
- **缓解**: agent 通常 4-6 轮就完成，总调用数与之前的 stopWhen(12) 接近
