## Why

执行 `/create` 后，用户在 CreateCommand 内部的 TextInput 输入名称时，App 主 TextInput 同时收到按键事件，将输入当作自然语言处理，触发"请先创建分身"的错误提示。根因是 ink 的 `useInput` 是全局广播——所有活跃的 useInput hook 都收到同一个按键，两个 TextInput 同时响应导致冲突。

## What Changes

- 在 AppState 中新增 `interactiveMode: boolean` 标志
- 交互式命令（create, use, publish, link, feed, distill）启动时设置 `interactiveMode: true`
- `interactiveMode` 为 true 时，不渲染 App 主 TextInput 和 SoulPrompt
- 交互式命令完成/取消时恢复 `interactiveMode: false`

## Capabilities

### New Capabilities

（无）

### Modified Capabilities

- `repl-shell`: App 组件区分静态输出和交互式命令，交互式命令执行期间禁用主 TextInput

## Impact

- **修改文件**: `src/cli/app.tsx`（主要修改）
- **无新增文件**
- **测试**: 需要验证现有测试不回归
