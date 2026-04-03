# OpenRouter Integration

OpenRouter LLM integration providing first-run setup wizard, model selection, the /model command, OpenAI SDK compatible client, config persistence, and streaming support.

## ADDED Requirements

### Requirement: First-Run Setup Wizard

The system SHALL detect when no API key is configured and launch an interactive setup wizard on first run. The wizard MUST prompt the user for their OpenRouter API key using a text input. The wizard MUST validate the key by calling the OpenRouter API (e.g., `GET /api/v1/auth/key`) to verify it is active and retrieve the account balance. The wizard MUST display the current balance to the user. Upon successful validation, the wizard MUST save the API key to `~/.soulkiller/config.yaml`.

#### Scenario: First Run With Valid Key

- WHEN the user launches the REPL for the first time with no existing config
- THEN the setup wizard activates and prompts for an OpenRouter API key
- WHEN the user enters a valid API key
- THEN the system validates the key against the OpenRouter API
- THEN the system displays the account balance (e.g., "Balance: $12.34")
- THEN the key is saved to `~/.soulkiller/config.yaml`
- THEN the wizard proceeds to model selection

#### Scenario: First Run With Invalid Key

- WHEN the user enters an invalid API key
- THEN the system displays a validation error message
- THEN the system prompts the user to re-enter the key

#### Scenario: Subsequent Runs With Existing Config

- WHEN the user launches the REPL and `~/.soulkiller/config.yaml` contains a valid `api_key`
- THEN the setup wizard is skipped
- THEN the REPL boots normally

### Requirement: Model Selection

The system SHALL present a list of recommended models during setup and allow the user to select a default model. The recommended list MUST include at minimum: `claude-sonnet-4.6` (with pricing), `deepseek-chat-v3.2` (with pricing), `gemini-3.1-pro` (with pricing), and `openrouter/free` (free tier). Each model entry MUST display the model name and per-token pricing. The user's selection MUST be saved as `default_model` in `~/.soulkiller/config.yaml`.

#### Scenario: Model Selection During Setup

- WHEN the setup wizard reaches the model selection step
- THEN a list of recommended models is displayed with pricing info
- WHEN the user selects `deepseek-chat-v3.2`
- THEN `default_model: deepseek-chat-v3.2` is saved to config

#### Scenario: Free Tier Selection

- WHEN the user selects `openrouter/free`
- THEN the system notes that free tier has rate limits and lower quality
- THEN `default_model: openrouter/free` is saved to config

### Requirement: Model Command

The `/model` command SHALL support three modes. With no arguments, it MUST display the currently active model and a list of available models. With a model ID argument, it MUST switch the active session model to the specified ID. With the `suggest` subcommand, it MUST recommend models based on use case (e.g., "creative writing" -> claude, "code" -> deepseek, "budget" -> free).

#### Scenario: Show Current Model

- WHEN the user types `/model`
- THEN the system displays the currently active model name
- THEN the system lists all available models with pricing

#### Scenario: Switch Model

- WHEN the user types `/model gemini-3.1-pro`
- THEN the active session model switches to `gemini-3.1-pro`
- THEN a confirmation message is displayed

#### Scenario: Model Suggestion

- WHEN the user types `/model suggest`
- THEN the system displays a categorized recommendation list (e.g., "Best for creative: claude-sonnet-4.6", "Best for code: deepseek-chat-v3.2", "Budget friendly: openrouter/free")

#### Scenario: Invalid Model ID

- WHEN the user types `/model nonexistent-model`
- THEN the system displays an error that the model ID is not recognized
- THEN the system suggests similar valid model IDs

### Requirement: OpenAI SDK Compatible Client

The system SHALL use the `openai` npm package to communicate with OpenRouter. The client MUST be configured with `baseURL` set to `https://openrouter.ai/api/v1` and the `apiKey` set to the user's OpenRouter API key. All LLM interactions MUST go through this client.

#### Scenario: Client Initialization

- WHEN the REPL boots and config contains a valid API key
- THEN an OpenAI client instance is created with baseURL `https://openrouter.ai/api/v1`
- THEN the client is available for all conversation and model operations

#### Scenario: Chat Completion Request

- WHEN the conversation engine sends a prompt to the LLM
- THEN the request is made via `openai.chat.completions.create()` with the active model
- THEN the response is returned to the conversation engine

### Requirement: Config Persistence

The system SHALL persist configuration to `~/.soulkiller/config.yaml`. The config file MUST store `api_key` (OpenRouter API key), `default_model` (default LLM model ID), and `distill_model` (model used for soul distillation). The system MUST create the `~/.soulkiller/` directory if it does not exist. Config reads and writes MUST be atomic to prevent corruption.

#### Scenario: Config File Creation

- WHEN the setup wizard completes and no config directory exists
- THEN `~/.soulkiller/` directory is created
- THEN `config.yaml` is written with `api_key`, `default_model`, and `distill_model`

#### Scenario: Config Update

- WHEN the user changes the default model via `/model` command
- THEN `config.yaml` is updated with the new `default_model` value
- THEN existing config values are preserved

### Requirement: Streaming Support

The system SHALL use OpenAI SDK streaming for all chat completions. The streaming call MUST use `openai.chat.completions.create({ stream: true })`. Each streamed chunk MUST be forwarded to the REPL's streaming output renderer. The system MUST handle stream interruption gracefully (e.g., network drop) by displaying a malfunction error.

#### Scenario: Successful Streaming Response

- WHEN the conversation engine requests a streamed completion
- THEN the SDK returns an async iterable of chunks
- THEN each chunk's delta content is forwarded to the streaming renderer
- THEN the complete response is assembled after the stream ends

#### Scenario: Stream Interrupted

- WHEN the network connection drops during streaming
- THEN the system detects the stream error
- THEN a MALFUNCTION-level error is displayed
- THEN the partial response is preserved in the conversation history
