# REPL Shell

Ink-based interactive REPL shell providing command parsing, natural language conversation, interactive prompts, streaming output, session state management, and built-in commands.

## ADDED Requirements

### Requirement: Command Parsing

The system SHALL distinguish between slash commands and natural language input. Input prefixed with `/` MUST be treated as a slash command and routed to the command dispatcher. All other input MUST be treated as natural language directed at the currently active soul's conversation engine.

#### Scenario: Slash Command Input

- WHEN the user types `/help`
- THEN the input is parsed as command name "help" with no arguments
- THEN the command dispatcher routes it to the help command handler

#### Scenario: Slash Command With Arguments

- WHEN the user types `/model deepseek-chat-v3.2`
- THEN the input is parsed as command name "model" with argument "deepseek-chat-v3.2"
- THEN the command dispatcher routes it to the model command handler with the argument

#### Scenario: Natural Language Input

- WHEN the user types "what do I think about consciousness?"
- THEN the input is forwarded to the conversation engine as a natural language query

#### Scenario: Unknown Slash Command

- WHEN the user types `/foobar`
- THEN the system displays an "unknown command" message
- THEN the system suggests similar known commands or displays `/help`

```acceptance
fixture: void
steps:
  - wait-prompt:
  - send: "/foobar"
  - expect: "UNKNOWN COMMAND"
```

### Requirement: Slash Command Routing

The system SHALL maintain a registry of slash command handlers. Each handler MUST be registered with a command name, optional aliases, a description, and an execute function. The dispatcher MUST match the input command name against registered handlers and invoke the matching handler with parsed arguments.

#### Scenario: Registered Command Execution

- WHEN the user types `/status`
- THEN the dispatcher finds the registered "status" handler
- THEN the handler's execute function is called
- THEN the handler's output is rendered in the terminal

#### Scenario: Command With Subcommand

- WHEN the user types `/model suggest`
- THEN the dispatcher routes to the "model" handler with subcommand "suggest"

### Requirement: Natural Language Conversation Mode

When a soul is loaded, the system SHALL forward all non-command input to the conversation engine. The conversation engine MUST perform a recall query against the soul's vector store, construct a prompt with retrieved context, and stream the LLM response back to the terminal. When no soul is loaded, natural language input MUST display a message instructing the user to load a soul first.

#### Scenario: Conversation With Loaded Soul

- WHEN a soul named "tang" is loaded and the user types "what's my opinion on AI art?"
- THEN the engine performs a recall query for "what's my opinion on AI art?"
- THEN the SOUL_RECALL panel displays matched memory chunks
- THEN the LLM generates a response using the recalled context
- THEN the response streams to the terminal

#### Scenario: No Soul Loaded

- WHEN no soul is loaded and the user types "hello"
- THEN the system displays a message: "No soul loaded. Use /ingest to create one or /load to load an existing soul."

```acceptance
fixture: void
steps:
  - wait-prompt:
  - send: "hello"
  - expect: "NO SOUL"
```

### Requirement: Interactive Prompts

The system SHALL support four types of interactive prompts for user input. Text input MUST accept free-form string entry. Checkbox multi-select MUST display options with `◉` (selected) and `◯` (unselected) markers and allow toggling. Confirm prompts MUST display a `(Y/n)` prompt and accept y/n input. File path input MUST accept typed paths and support terminal drag-and-drop of files.

#### Scenario: Text Input Prompt

- WHEN the setup wizard asks for an API key
- THEN a text input field is displayed with a label
- THEN the user types their key and presses Enter
- THEN the entered value is returned to the caller

#### Scenario: Checkbox Multi-Select

- WHEN the ingest command asks which data sources to use
- THEN a list of options is displayed with `◯` markers
- THEN the user toggles options using Space key, showing `◉` for selected
- THEN the user confirms with Enter
- THEN the selected options are returned as an array

#### Scenario: Confirm Prompt

- WHEN the system asks "Proceed with ingestion? (Y/n)"
- THEN the user types "y" or presses Enter (default yes)
- THEN the boolean result is returned to the caller

#### Scenario: File Path With Drag-and-Drop

- WHEN the ingest command asks for a directory path
- THEN the user drags a folder from Finder into the terminal
- THEN the dropped path is captured and used as input

### Requirement: Streaming Output Rendering

The system SHALL render LLM streaming tokens progressively as they arrive. The rendering loop MUST throttle re-renders to a maximum of once every 50 milliseconds to prevent terminal flicker. Partial tokens MUST be appended to the current output buffer and displayed incrementally.

#### Scenario: Normal Streaming Response

- WHEN the LLM streams 200 tokens over 3 seconds
- THEN tokens appear progressively in the terminal
- THEN the terminal re-renders at most every 50ms
- THEN the final output matches the complete LLM response

#### Scenario: Fast Token Burst

- WHEN the LLM sends 50 tokens within a single 50ms window
- THEN all 50 tokens are batched and rendered in one re-render cycle
- THEN no visual flicker occurs

### Requirement: Session State Management

The system SHALL maintain session state tracking the current soul (none, own, or relic), the active engine mode (docker or local), and the active LLM model. State changes MUST be reflected immediately in the prompt display. Session state MUST be accessible to all command handlers and the conversation engine.

#### Scenario: State After Boot

- WHEN the REPL finishes booting
- THEN session state shows soul=none, engine=detected mode, model=configured default

#### Scenario: State After Soul Load

- WHEN the user successfully ingests data for soul "tang"
- THEN session state updates to soul="tang" with type=own
- THEN the prompt updates to `◈ soul://tang >`

### Requirement: Help Command

The `/help` command SHALL display all available commands grouped by category. Each command entry MUST show the command name, aliases (if any), and a brief description. Categories MUST include at minimum: Soul Management, Configuration, and System.

#### Scenario: Display Help

- WHEN the user types `/help`
- THEN a formatted list of all commands is displayed
- THEN commands are grouped under category headings
- THEN each entry shows name, aliases, and description

```acceptance
fixture: void
steps:
  - wait-prompt:
  - send: "/help"
  - expect: "COMMANDS|commands"
  - not-expect: "UNKNOWN COMMAND"
```

### Requirement: Exit Command

The `/exit` command SHALL trigger the exit animation sequence and then terminate the process with `process.exit(0)`.

#### Scenario: Exit Via Command

- WHEN the user types `/exit`
- THEN the exit animation plays in full
- THEN the process exits with code 0

```acceptance
fixture: void
steps:
  - wait-prompt:
  - send: "/exit"
  - wait-exit: 0
```

### Requirement: All command output uses i18n

All slash command output (create wizard, evolve pipeline, feedback ratings, config display, model selection, recall results, source display, list output, help text) SHALL use `t()` for user-visible strings.

#### Scenario: Create wizard in English

- **WHEN** language is `en` and user runs `/create`
- **THEN** all wizard prompts, labels, confirmations SHALL be in English

#### Scenario: Evolve pipeline in Japanese

- **WHEN** language is `ja` and user runs `/evolve`
- **THEN** source selection labels, dimension options, pipeline step names SHALL be in Japanese

#### Scenario: Feedback ratings in configured language

- **WHEN** user runs `/feedback`
- **THEN** rating labels (很像本人/基本像/不太像/完全不像) SHALL be displayed in the configured language

### Requirement: Command parsing uses shared registry
The command parser and help command SHALL consume command definitions from a single shared registry instead of maintaining separate lists.

#### Scenario: Registry is single source of truth
- **WHEN** a new command is added to the command registry
- **THEN** it appears in help output, completion candidates, and command parser recognition without additional changes

#### Scenario: Help output matches registry
- **WHEN** user runs /help
- **THEN** all commands from the registry are displayed grouped by their registered group

### Requirement: Interactive commands disable main input
When an interactive command (one that contains its own input elements) is active, the App SHALL NOT render the main TextInput or SoulPrompt to prevent useInput conflicts.

#### Scenario: /create hides main input
- **WHEN** user executes /create and the CreateCommand component is rendered
- **THEN** the main TextInput and SoulPrompt are not rendered
- **AND** only CreateCommand's internal inputs receive keyboard events

#### Scenario: Interactive command completion restores input
- **WHEN** an interactive command completes (success or error)
- **THEN** the main TextInput and SoulPrompt are rendered again
- **AND** the user can type new commands

#### Scenario: Static commands keep main input active
- **WHEN** user executes /help or /status or /list
- **THEN** the main TextInput and SoulPrompt remain rendered and active

### Requirement: TextInput supports onEscape callback
TextInput SHALL accept an optional `onEscape` prop that is called when Esc is pressed and no completion list is open.

#### Scenario: Esc with no completion list
- **WHEN** user presses Esc in a TextInput with onEscape set and no completion list is open
- **THEN** the onEscape callback is invoked

#### Scenario: Esc with completion list open
- **WHEN** user presses Esc in a TextInput with a completion list open
- **THEN** the completion list closes (existing behavior) and onEscape is NOT called

### Requirement: TextInput supports argument completion map
TextInput SHALL accept an optional `argCompletionMap` prop that maps command names to argument candidate providers.

#### Scenario: Argument completion activates after command + space
- **WHEN** user types `/use ` and argCompletionMap contains a 'use' entry
- **THEN** the argument provider function is called and results are shown in a completion palette

#### Scenario: No argument completion for unmapped commands
- **WHEN** user types `/help ` and argCompletionMap has no 'help' entry
- **THEN** no argument completion list appears

### Requirement: CommandPalette title is configurable
CommandPalette SHALL accept an optional `title` prop (default "COMMANDS").

#### Scenario: Custom title
- **WHEN** CommandPalette is rendered with title="SOULS"
- **THEN** the palette header displays "SOULS"

### Requirement: App renders ConversationView for natural language input
When a soul is loaded and the user types natural language, the App SHALL render the ConversationView component instead of a bare StreamingText.

#### Scenario: Conversation mode rendering
- **WHEN** a soul is loaded and user submits natural language
- **THEN** the App renders ConversationView with full history, thinking state, and streaming state
- **AND** the conversation view appears above the input prompt

### Requirement: /use loads a soul and enters conversation mode
The `/use <name>` command SHALL load the specified soul, initialize the engine, and enter conversation mode. Upon loading a new soul, the system SHALL clear all prior conversation state.

#### Scenario: Switching from one soul to another
- **WHEN** user has an active conversation with soul A and runs `/use B`
- **THEN** the conversation display SHALL be cleared (no messages from soul A visible)
- **AND** the LLM conversation context SHALL be reset (no prior messages sent to the model)
- **AND** the user sees the RELIC load animation for soul B
- **AND** subsequent messages go to soul B with a clean context

#### Scenario: Using the same soul again
- **WHEN** user runs `/use <name>` where name matches the currently loaded soul
- **THEN** the system SHALL do nothing (no-op, no conversation reset)

### Requirement: /export 命令路由

REPL 的 handleInput 命令路由 SHALL 新增 `export` case，渲染 ExportCommand 组件并设置 interactiveMode。

#### Scenario: 路由 /export 命令

- **WHEN** 用户输入 `/export`
- **THEN** handleInput SHALL 匹配 "export" case
- **AND** 设置 `interactiveMode: true`
- **AND** 渲染 ExportCommand 组件

### Requirement: /list 交互式 Soul 列表
`/list` SHALL 进入交互式 Soul 列表，显示所有本地 Soul 的名称和 chunk 数。用户通过方向键选择、Enter 进入子操作菜单、ESC 退出。

#### Scenario: 展示 Soul 列表
- **WHEN** 用户执行 `/list` 且有 2 个本地 Soul
- **THEN** 显示交互式列表，每个 Soul 显示 name 和 chunk_count

#### Scenario: 空列表
- **WHEN** 用户执行 `/list` 且无本地 Soul
- **THEN** 显示空列表提示

### Requirement: Soul 子操作菜单
选中 Soul 后 SHALL 显示子操作菜单：详情、加载、进化、删除。ESC 返回列表。

#### Scenario: 子操作菜单展示
- **WHEN** 用户选中 "alice"
- **THEN** 显示子操作菜单（详情/加载/进化/删除）

### Requirement: Soul 详情查看
选择「详情」SHALL 展示 Soul 的 manifest 信息和 soul files 概览。

#### Scenario: 查看详情
- **WHEN** 用户选择「详情」
- **THEN** 显示 name、display_name、soulType、tags、chunk_count、evolve_history

### Requirement: Soul 加载
选择「加载」SHALL 触发 onUse 回调加载该 Soul。

#### Scenario: 加载 Soul
- **WHEN** 用户选择「加载」
- **THEN** 调用 onUse(soulName, soulDir)，退出列表

### Requirement: Soul 进化
选择「进化」SHALL 渲染 CreateCommand 补充模式。

#### Scenario: 进化 Soul
- **WHEN** 用户选择「进化」
- **THEN** 渲染 CreateCommand(supplementSoul={name, dir})

### Requirement: Soul 删除
选择「删除」SHALL 显示确认提示，确认后删除 Soul 目录并返回列表。

#### Scenario: 删除确认
- **WHEN** 用户选择「删除」
- **THEN** 显示确认提示（Soul 名称 + 确认/取消选项）

#### Scenario: 确认删除
- **WHEN** 用户在确认提示选择「确认」
- **THEN** 删除 Soul 目录，返回列表（列表刷新）

#### Scenario: 取消删除
- **WHEN** 用户在确认提示选择「取消」
- **THEN** 返回子操作菜单

### Requirement: 命令输入处理
App 组件的 handleInput SHALL 将 slash 命令分发委托给 command-router 的 dispatch 函数，不再包含命令级的 switch-case 逻辑。handleInput 仅保留两个职责：(1) 调用 `parseInput` 区分 slash/natural；(2) slash 命令调用 `dispatch(parsed, ctx)`，natural input 走对话流。

#### Scenario: slash 命令分发
- **WHEN** 用户输入以 `/` 开头的文本
- **THEN** handleInput 调用 `dispatch(parsed, ctx)` 进行路由，不直接处理任何命令逻辑

#### Scenario: natural input 不变
- **WHEN** 用户输入不以 `/` 开头的文本
- **THEN** handleInput 按原有对话流逻辑处理（assembleContext → streamChat），不经过路由器
