## Why

对话体验有三个问题：
1. 用户输入提交后消失，没有在对话区域回显——不知道自己问了什么
2. 分身回复是裸文本，没有角色标识头，无法区分谁在说话
3. 回复过程中没有加载动画——输入后一片空白直到文字开始出现

对标 Claude Code 的对话 UI：用户输入有 `❯` 前缀回显，AI 回复有角色名标识，思考中有 spinner。

## What Changes

- 新增 `<ConversationView />` 组件：渲染对话历史（用户消息 + 分身回复），每轮对话带角色标识
- 新增 `<ThinkingIndicator />` 组件：分身回复前的加载动画（SOUL_RECALL 面板 + spinner）
- 修改 App 的对话流程：用户输入 → 回显到历史 → 显示 thinking → SOUL_RECALL 面板 → 流式回复 → 追加到历史
- 对话历史在屏幕上持续展示（不是只显示最后一轮）

## Capabilities

### New Capabilities

- `conversation-view`: 对话视图组件——渲染完整对话历史，用户消息带 `❯` 前缀，分身回复带 `◈ {name}` 标识头，Cyberpunk 配色

### Modified Capabilities

- `soul-conversation`: 对话流程集成 ConversationView + ThinkingIndicator + SOUL_RECALL 面板
- `repl-shell`: App 的自然语言对话渲染从裸 StreamingText 改为 ConversationView

## Impact

- **新增文件**: `src/cli/components/conversation-view.tsx`, `src/cli/components/thinking-indicator.tsx`
- **修改文件**: `src/cli/app.tsx`
- **测试**: 新增 conversation-view 和 thinking-indicator 快照测试
