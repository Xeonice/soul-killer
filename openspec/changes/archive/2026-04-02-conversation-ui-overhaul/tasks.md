## 1. ConversationView 组件

- [x] 1.1 创建 `src/cli/components/conversation-view.tsx`：渲染对话历史，用户消息 `❯` dim + 分身回复 `◈ name` magenta + content cyan，轮次间分隔线
- [x] 1.2 支持 streamContent prop：最后一轮分身回复正在流式输出时，实时渲染
- [x] 1.3 历史限制：最多渲染最近 20 轮

## 2. ThinkingIndicator 组件

- [x] 2.1 创建 `src/cli/components/thinking-indicator.tsx`：`◈ {name}` + braille spinner + "scanning memory cortex..."，magenta 色

## 3. App 对话流改造

- [x] 3.1 AppState 新增 `conversationMessages: ConversationMessage[]`、`isThinking: boolean`、`streamContent: string`
- [x] 3.2 用户提交自然语言 → push user message 到 conversationMessages → 渲染回显
- [x] 3.3 recall 阶段：isThinking = true → 显示 ThinkingIndicator
- [x] 3.4 流式输出阶段：isThinking = false → 逐 token 更新 streamContent → ConversationView 实时渲染
- [x] 3.5 流结束：push assistant message → 清空 streamContent
- [x] 3.6 主 REPL 渲染：commandOutput 上方渲染 ConversationView

## 4. 测试

- [x] 4.1 组件快照：ConversationView 多轮对话、空历史、流式中状态
- [x] 4.2 组件快照：ThinkingIndicator
- [x] 4.3 回归：现有测试继续通过
