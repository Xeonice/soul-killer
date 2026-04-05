## Context

当前 `captureSoul()` 是一个 4 步固定管线：deterministic search → LLM classify → strategy deep search → relevance filter。LLM 只参与 2 个判断点，搜索策略完全由代码控制。这在 MVP 阶段运行良好，但扩展性受限——每增加一种目标类型都需要手写策略文件。

AI SDK v6 新增了 `ToolLoopAgent` 类，提供了开箱即用的 agent loop：自动处理 tool calling 循环、步数控制、流式事件。这使得我们可以用声明式配置替代手动编排。

现有代码中 `search-factory.ts` 已经定义了 tool schemas（Zod），只是没让 LLM 自动调用。重构的核心是把「手动执行」改为「LLM 自主调用」。

## Goals / Non-Goals

**Goals:**
- 用 ToolLoopAgent 替��手动 4 步管线，LLM 自主决定搜索策略
- 保持 `CaptureResult` 接口不变（classification, origin, chunks, elapsedMs）
- 保持 `CaptureProgress` 事件与 UI 的兼容性
- 保留现有搜索能力（Tavily/DuckDuckGo、Wikipedia、page extraction）
- maxSteps = 30

**Non-Goals:**
- 不改变 LLM provider 配置（继续用 OpenRouter via @ai-sdk/openai-compatible）
- 不改变 UI 组件（SoulkillerProtocolPanel 只做事件适配，不重新设计）
- 不引入会话持久化或 context compaction（单次执行，不需要跨会话）
- 不改变 /create 命令的整体流程（agent 仍然是其中一个步骤）

## Decisions

### 1. 使用 ToolLoopAgent 而非手动 while 循环

**选择**: `new ToolLoopAgent({ ... })` + `agent.generate()`

**替代方案**: 手动 `while` 循环 + `streamText()`（OpenCode 的做法）

**理由**: ToolLoopAgent 已经内置了 step 跟踪、tool execution、finish reason 判断、stopWhen 条件。手动循环需要自己处理 message 拼接和 tool result 反馈。对于我们的场景（单次执行、无需跨步动态换模型），ToolLoopAgent 足够且更简洁。

### 2. reportFindings 作为无 execute 的终止 tool

**选择**: 定义 `reportFindings` tool 但不提供 `execute` 函数，配合 `hasToolCall('reportFindings')` 停止条件

**理由**: 这是 AI SDK 文档推荐的模式（forced tool calling + done tool）。LLM 调用 reportFindings 时循环自动停止，结果从 `result.staticToolCalls` 中提取。不需要解析 LLM 的自由文本来判断是否完成。

**Schema**:
```typescript
reportFindings: tool({
  description: 'Report your findings when you have gathered enough information about the target.',
  inputSchema: z.object({
    classification: z.enum(['DIGITAL_CONSTRUCT', 'PUBLIC_ENTITY', 'HISTORICAL_RECORD', 'UNKNOWN_ENTITY']),
    origin: z.string().optional().describe('Source work, organization, or era'),
    summary: z.string().describe('One paragraph summary of who/what the target is'),
    extractions: z.array(z.object({
      content: z.string(),
      url: z.string().optional(),
      searchQuery: z.string(),
    })),
  }),
  // 无 execute → 调用时循环停止
})
```

### 3. toolChoice: 'required' 强制每步都用 tool

**选择**: 设置 `toolChoice: 'required'`

**理由**: 我们希望 agent 每步要么搜索要么报告结果，不希望它生成无工具调用的纯文本回复（那会导致循环提前结束）。配合 reportFindings 终止 tool，这形成了一个清晰的「搜索直到完成」模式。

### 4. prepareStep 实现 doom loop 检测

**选择**: 在 `prepareStep` 回调中检查最近 3 步是否为相同 tool + 相同参数

**实现**:
```typescript
prepareStep: async ({ stepNumber, steps }) => {
  // 最后一步强制报告
  if (stepNumber >= 29) {
    return { toolChoice: { type: 'tool', toolName: 'reportFindings' } }
  }

  // Doom loop: 连续 3 次相同调用
  const recent = steps.slice(-3)
  if (recent.length === 3) {
    const calls = recent.map(s => s.toolCalls?.[0]).filter(Boolean)
    if (calls.length === 3 &&
        calls.every(c => c.toolName === calls[0].toolName &&
                         JSON.stringify(c.args) === JSON.stringify(calls[0].args))) {
      return { toolChoice: { type: 'tool', toolName: 'reportFindings' } }
    }
  }

  return {}
}
```

### 5. onStepFinish 映射到 CaptureProgress

**选择**: 在 `onStepFinish` 中将 AI SDK 事件转换为现有的 `CaptureProgress` 类型

**映射规则**:
- step 0 开始时 → `{ type: 'phase', phase: 'searching' }`
- 每次 tool call → `{ type: 'tool_call', tool, query }` + `{ type: 'tool_result', tool, resultCount }`
- step > 5 → `{ type: 'phase', phase: 'analyzing' }`（表示进入深搜阶段）
- reportFindings 被调用 → `{ type: 'classification', ... }` + `{ type: 'chunks_extracted', ... }` + `{ type: 'phase', phase: 'complete' }`

### 6. System Prompt 设计

system prompt 需要告诉 LLM：
- 角色：Soulkiller Protocol，情报提取系统
- 任务：搜集目标信息，构建全面画像
- 策略指导：先广搜定位身份，再根据类型深搜（虚构角色→wiki/fandom，公众人物→访谈/发言，历史人物→学术/传记）
- 多语言：中/英/日
- 偏好：优先收集引用、观点、性格特征、行为模式
- 终止条件：8+ 条实质信息，或 3+ 次搜索无新结果，或目标确认为未知
- 禁止：不要编造信息，不要重复搜索相同关键词

### 7. 现有 tools 复用方式

`search-factory.ts` 改为导出两种形式：
- `createAgentTools(config)` → 返回 AI SDK `tool()` 定义（新，供 ToolLoopAgent 使用）
- 保留 `createSearchTools(config)` → 返回 executors（向后兼容，其他地方可能用到）

tool execute 函数内部复用现有的 `executeTavilySearch`、`executeWebSearch`、`executeWikipediaSearch`、`extractPageContent`。

### 8. 移除的代码

- `src/agent/strategies/` 整个目录（digital-construct.ts, public-entity.ts, historical-record.ts, types.ts, index.ts）
- `soul-capture-agent.ts` 中的 `runDeterministicSearch()`、`classifyWithLLM()`、`filterRelevantExtractions()`、`parseIdentificationJSON()`
- `CLASSIFY_PROMPT` 常量

## Risks / Trade-offs

**[不确定性增加]** LLM 自主搜索意味着同一目标每次执行路径可能不同 → 可接受，因为最终结果（收集到的信息质量）才是关键，不要求路径确定性

**[成本可能上升]** 30 步上限比固定 4 步管线消耗更多 token → 实际上 LLM 通常在 5-10 步内完成；prepareStep doom loop 检测 + hasToolCall 终止兜底

**[System Prompt 质量]** Agent 效果高度依赖 system prompt 的设计 → 需要实际测试迭代，可能需要多轮调优

**[CaptureProgress phase 顺序不再固定]** 旧代码按 initiating→searching→classifying→analyzing→filtering→complete 顺序发送 → 新代码中 phase 可能跳跃（无 classifying/filtering）→ UI 组件需要适配为更宽容的状态显示
