## Context

当前对话在 App 里用一个裸的 `<StreamingText />` 渲染，没有对话历史、没有角色标识、没有加载状态。需要一套完整的对话 UI。

## Goals / Non-Goals

**Goals:**
- 用户输入提交后在对话区域回显（`❯ 用户输入` dim 色）
- 分身回复带角色标识头（`◈ 分身名` magenta）
- 回复前显示 thinking 动画（SOUL_RECALL 面板）
- 对话历史滚动显示（保留最近 N 轮）
- Cyberpunk 视觉风格一致

**Non-Goals:**
- 对话历史持久化到文件
- 多轮对话的 context window 管理（已有 conversationRef）
- 对话导出

## Decisions

### D1: 对话视图结构

```
┌─────────────────────────────────────────┐
│  对话历史区域                             │
│                                          │
│  ❯ 你好强尼                              │  ← 用户消息，dim 色
│                                          │
│  ◈ 强尼银手                              │  ← 分身标识，magenta
│  (从全息投影中突然显现...)                 │  ← 回复内容，cyan
│  "Wake the fuck up, samurai!"            │
│                                          │
│  ─────────────────────────               │  ← 轮次分隔线
│                                          │
│  ❯ 你对企业怎么看？                       │  ← 第二轮用户消息
│                                          │
│  ◈ 强尼银手                              │
│  ⠋ thinking...                           │  ← 加载中（或 SOUL_RECALL）
│                                          │
├─────────────────────────────────────────┤
│  ◈ soul://强尼银手 [RELIC] > █            │  ← 输入区
└─────────────────────────────────────────┘
```

### D2: ConversationView 组件

```typescript
interface ConversationMessage {
  role: 'user' | 'assistant'
  content: string
  timestamp?: number
}

interface ConversationViewProps {
  messages: ConversationMessage[]
  soulName: string
  isStreaming: boolean
  streamContent?: string  // 正在流式输出的内容
  isThinking: boolean     // 是否在 recall 阶段
  recallResults?: RecallResult[]
}
```

渲染逻辑：
1. 遍历 messages 渲染已完成的对话
2. 如果 isThinking，在末尾渲染 ThinkingIndicator
3. 如果 isStreaming，在末尾渲染流式内容

### D3: ThinkingIndicator

```
◈ 强尼银手
⠋ scanning memory cortex...
```

用 braille spinner（⠋⠙⠹⠸⠼⠴⠦⠧⠇⠏）+ "scanning memory cortex..."，magenta 色。
如果有 recall 结果，展示 SOUL_RECALL 面板（已有组件），然后过渡到流式输出。

### D4: App 对话流状态

```
用户输入 → 
  1. messages.push({ role: 'user', content })
  2. isThinking = true
  3. engine.recall() → recallResults
  4. isThinking = false, isStreaming = true
  5. streamChat() → 逐 token 更新 streamContent
  6. 流结束 → messages.push({ role: 'assistant', content: fullText })
  7. isStreaming = false
```

AppState 新增：
- `conversationMessages: ConversationMessage[]` — 完整对话历史
- `isThinking: boolean`
- `streamContent: string` — 当前流式输出的文本

### D5: 历史轮次限制

保留最近 20 轮对话在屏幕上。超过的自动从渲染中移除（但 conversationRef 里的 LLM context 不受影响）。
