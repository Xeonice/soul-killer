## MODIFIED Requirements

### Requirement: 命令输入处理
App 组件的 handleInput SHALL 将 slash 命令分发委托给 command-router 的 dispatch 函数，不再包含命令级的 switch-case 逻辑。handleInput 仅保留两个职责：(1) 调用 `parseInput` 区分 slash/natural；(2) slash 命令调用 `dispatch(parsed, ctx)`，natural input 走对话流。

#### Scenario: slash 命令分发
- **WHEN** 用户输入以 `/` 开头的文本
- **THEN** handleInput 调用 `dispatch(parsed, ctx)` 进行路由，不直接处理任何命令逻辑

#### Scenario: natural input 不变
- **WHEN** 用户输入不以 `/` 开头的文本
- **THEN** handleInput 按原有对话流逻辑处理（assembleContext → streamChat），不经过路由器
