## Context

ink 的 `useInput` hook 是全局广播机制，所有挂载的组件中的 useInput 都会收到相同的按键事件。当 App 主 TextInput 和 CreateCommand 内部的 TextInput 同时存在时，一次按键被两处处理。

## Goals / Non-Goals

**Goals:**
- 交互式命令执行期间，主 TextInput 不渲染、不接收输入
- 交互式命令完成后，自动恢复主 TextInput
- 改动最小化，只动 app.tsx

**Non-Goals:**
- 不改 ink 底层的 useInput 机制
- 不改各命令组件的内部实现

## Decisions

### D1: 条件渲染主 TextInput

在 AppState 中加 `interactiveMode: boolean`。当 `interactiveMode === true` 时，主 REPL 区域只渲染 `{state.commandOutput}`，不渲染 TextInput 和 SoulPrompt。

```
interactiveMode = false:
  {commandOutput}    ← 静态输出（help, status, source...）
  {error}
  <TextInput />      ← 活跃
  <SoulPrompt />     ← 活跃

interactiveMode = true:
  {commandOutput}    ← 交互式命令（create, publish...），自带 TextInput
  {error}
                     ← 主 TextInput 不渲染
                     ← SoulPrompt 不渲染
```

### D2: 哪些命令是交互式的

| 命令 | 交互式？ | 原因 |
|------|---------|------|
| /create | ✓ | 多步 TextInput + CheckboxSelect |
| /use | ✓ | 可能有下载确认 |
| /publish | ✓ | TextInput 输入 repo 名 |
| /link | ✓ | Confirm 确认 |
| /feed | ✓ | 有进度显示 |
| /distill | ✓ | 有进度显示 |
| /help | ✗ | 纯输出 |
| /status | ✗ | 纯输出 |
| /source | ✗ | 纯输出 |
| /list | ✗ | 纯输出 |
| /model | ✗ | 纯输出 |
| /recall | ✗ | 纯输出（结果展示） |

## Risks / Trade-offs

### R1: 交互式命令异常退出
- **风险**: 命令出错后 interactiveMode 卡在 true，用户无法输入
- **缓解**: 命令的 error 状态也要恢复 interactiveMode = false。在 onComplete 回调和 error 渲染中都要恢复。
