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

### Requirement: Quit Command

The `/quit` command SHALL trigger the exit animation sequence and then terminate the process with `process.exit(0)`. Aliases MUST include `/exit` and `/q`.

#### Scenario: Quit Via Command

- WHEN the user types `/quit`
- THEN the exit animation plays in full
- THEN the process exits with code 0

#### Scenario: Quit Via Alias

- WHEN the user types `/q`
- THEN the behavior is identical to `/quit`
