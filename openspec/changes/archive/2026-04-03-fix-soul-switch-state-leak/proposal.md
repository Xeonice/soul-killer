## Why

切换 soul（`/use <name>`）时，旧角色的对话历史没有被清除。导致两个问题：
1. **UI 残留**：切换后屏幕上仍显示旧角色的对话，新旧角色混在一起
2. **上下文污染**：`conversationRef` 没清空，旧角色的对话作为 LLM 上下文传给了新角色，影响新角色的回复质量
3. **feedback 错位**：`/feedback` 在混合历史中取最后一条消息，可能抓到旧角色的对话

同样，`handleCreateComplete` 也有相同问题——创建完新 soul 后对话历史未清除。

## What Changes

- **`handleUseComplete`**：切换 soul 时清空 `conversationMessages`（state）和 `conversationRef.current`（ref）
- **`handleCreateComplete`**：创建 soul 完成后同样清空对话历史
- **`/evolve` 中的 soul 切换**：evolve 路由中设置 soulDir 时也需要清空对话

## Capabilities

### New Capabilities
（无）

### Modified Capabilities
- `repl-shell`: `/use` 切换 soul 时必须重置对话状态
- `soul-conversation`: 对话状态需要与当前 soul 强绑定，soul 变更时自动清空

## Impact

- `src/cli/app.tsx` — `handleUseComplete`、`handleCreateComplete`、evolve 路由中的 soul 切换逻辑
