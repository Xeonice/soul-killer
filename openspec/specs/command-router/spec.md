## ADDED Requirements

### Requirement: CommandHandler 接口
每个命令 SHALL 通过 `CommandHandler` 接口声明自身的元数据、前置条件、参数定义、交互模式和处理函数。处理函数接收 `CommandContext` 并返回 `ReactNode | void | Promise<ReactNode | void>`。

#### Scenario: 简单命令定义
- **WHEN** 定义一个无前置条件的命令（如 help）
- **THEN** handler 只需声明 name、descriptionKey、groupKey 和 handle 函数

#### Scenario: 带前置条件的命令定义
- **WHEN** 定义需要 soul 和 args 的命令（如 recall）
- **THEN** handler 的 requires 数组包含 `['args', 'engine']`，argDef 指定参数名

#### Scenario: interactive 命令定义
- **WHEN** 定义交互式命令（如 config）
- **THEN** handler 的 interactive 字段为 true，路由器自动设置 interactiveMode

### Requirement: 路由器前置条件检查
路由器 SHALL 在调用 handle 之前，按 handler 的 requires 数组依次检查前置条件。任一条件不满足时 SHALL 设置对应的错误信息并终止分发，不调用 handle。

#### Scenario: 缺少必需参数
- **WHEN** 用户输入 `/recall`（无参数）且 recall 的 requires 包含 'args'
- **THEN** 路由器设置 error `{ severity: 'warning', title: 'MISSING ARGUMENT', message: t('error.missing_argument', { command: 'recall', arg: 'query' }) }` 且不调用 handle

#### Scenario: soul 未加载
- **WHEN** 用户输入 `/evolve status` 且当前无 soulDir
- **THEN** 路由器设置 error `{ severity: 'warning', title: 'NO SOUL' }` 且不调用 handle

#### Scenario: engine 未就绪
- **WHEN** 用户输入 `/recall some-query` 且 engineRef.current 为 null
- **THEN** 路由器设置 error `{ severity: 'warning', title: 'NO ENGINE' }` 且不调用 handle

#### Scenario: 无对话上下文
- **WHEN** 用户输入 `/feedback` 且 conversationRef.current.length < 2
- **THEN** 路由器设置 error `{ severity: 'warning', title: 'NO CONVERSATION' }` 且不调用 handle

### Requirement: 子命令路由
路由器 SHALL 支持可选的二级子命令分发。当 handler 声明了 subcommands 字段时，路由器 SHALL 取 args 的首个空格分隔 token 匹配子命令表。

#### Scenario: 子命令匹配
- **WHEN** 用户输入 `/evolve status` 且 evolve handler 的 subcommands 包含 'status' 键
- **THEN** 路由器调用 `subcommands['status']` 的 handle，传入的 ctx.args 为空字符串

#### Scenario: 子命令不匹配
- **WHEN** 用户输入 `/evolve saber` 且 'saber' 不在 subcommands 键中
- **THEN** 路由器调用 evolve 的默认 handle，ctx.args 为 'saber'

#### Scenario: 子命令的独立前置条件
- **WHEN** evolve 默认 handler 无 requires，但 subcommands['status'] 的 requires 包含 'soul'
- **THEN** 路由 `/evolve status` 时检查 soul 前置条件，路由 `/evolve saber` 时不检查

### Requirement: 未知命令处理
路由器 SHALL 在注册表中找不到命令时，调用 `suggestCommand` 进行模糊匹配，并设置 UNKNOWN COMMAND 错误。

#### Scenario: 有近似建议
- **WHEN** 用户输入 `/hepl` 且 suggestCommand 返回 'help'
- **THEN** 错误消息包含建议命令

#### Scenario: 无近似建议
- **WHEN** 用户输入 `/xyz` 且 suggestCommand 返回 null
- **THEN** 错误消息仅提示未知命令

### Requirement: handle 返回值处理
路由器 SHALL 根据 handle 返回值决定 setState 行为。

#### Scenario: 返回 ReactNode
- **WHEN** handle 返回一个 React 元素
- **THEN** 路由器 setState 设置 commandOutput 为该元素，interactiveMode 为 handler.interactive ?? false

#### Scenario: 返回 void
- **WHEN** handle 返回 void（如 /exit 直接 setState 改 phase）
- **THEN** 路由器不再额外调用 setState

#### Scenario: 返回 Promise
- **WHEN** handle 返回 Promise<ReactNode>（如 /status 异步获取 engine 状态）
- **THEN** 路由器 await 结果后按 ReactNode 或 void 规则处理
