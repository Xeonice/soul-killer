## ADDED Requirements

### Requirement: Per-session log file creation
The system SHALL create a new, independent log file for each `captureSoul` invocation at `~/.soulkiller/logs/agent/`.

#### Scenario: Log file is created on agent start
- **WHEN** `captureSoul` is called with prompt "Research Hideo Kojima"
- **THEN** a log file is created at `~/.soulkiller/logs/agent/{timestamp}_{hash8}.log` where timestamp is `YYYY-MM-DDTHH-mm-ss` format and hash8 is the first 8 characters of SHA256(prompt)

#### Scenario: Log directory is auto-created
- **WHEN** `~/.soulkiller/logs/agent/` does not exist
- **THEN** the directory is created recursively before writing the log file

### Requirement: META header in log file
The system SHALL write a META header at the top of each log file containing the original prompt, timestamp, model name, search provider, and config summary.

#### Scenario: META header content
- **WHEN** a log file is created for prompt "Research Hideo Kojima" with model "qwen/qwen3-235b-a22b" and provider "searxng"
- **THEN** the file starts with a META section containing all of: original prompt (untruncated), ISO timestamp, model identifier, resolved search provider, and serialized config

### Requirement: Step-level logging
The system SHALL log each agent step with a visual separator, step number, current phase, and step duration.

#### Scenario: Step boundary recorded
- **WHEN** step 3 starts in phase "classifying"
- **THEN** the log contains a step separator with "STEP 3 — Phase: classifying" and after the step completes, the step duration in milliseconds

### Requirement: Model text output logging
The system SHALL capture and log the model's text output (reasoning text before tool calls) from `text-delta` stream events.

#### Scenario: Model reasoning text is recorded
- **WHEN** the model emits text-delta events "I'll search for" and " information about" before a tool call
- **THEN** the log contains the concatenated text "I'll search for information about" under a "Model Output" section within the current step

#### Scenario: No text output for a step
- **WHEN** a step has no text-delta events (direct tool call)
- **THEN** no "Model Output" section is written for that step

### Requirement: Tool call and result logging
The system SHALL log every tool call with its name, full input, full output, and duration. Tool outputs SHALL include both a human-readable summary and a full JSON block.

#### Scenario: Search tool call logged
- **WHEN** the search tool is called with input `{"query": "Hideo Kojima"}`
- **THEN** the log contains: tool name "search", input JSON, a human-readable result summary (e.g., "10 results"), the full output JSON block, and the call duration in milliseconds

#### Scenario: extractPage tool call logged
- **WHEN** the extractPage tool is called with url "https://example.com"
- **THEN** the log contains: tool name "extractPage", the URL, success/failure status, content length if successful, and duration

### Requirement: Tool internal detail logging
The system SHALL log internal details of tool execution including search provider selection, HTTP request URLs, response status codes, raw result counts, and sub-operation details.

#### Scenario: SearXNG search internals
- **WHEN** a search is executed via SearXNG provider
- **THEN** the log contains `[INTERNAL]` lines showing: provider name, request URL, raw result count, number of short snippets identified for page extraction, and per-page extraction results

#### Scenario: Tavily/Exa search internals
- **WHEN** a search is executed via Tavily or Exa provider
- **THEN** the log contains `[INTERNAL]` lines showing: provider name, result count, and duration

### Requirement: Result summary block
The system SHALL write a RESULT block at the end of the capture phase containing: classification, origin, chunk count, total steps, and total duration.

#### Scenario: Successful capture result
- **WHEN** the agent completes with classification "PUBLIC_ENTITY", 47 chunks, 12 steps in 45678ms
- **THEN** the log contains a RESULT block with all these values

### Requirement: Analysis summary block
The system SHALL append an ANALYSIS block after RESULT containing: dimension coverage histogram, search statistics, and a chronological tool call timeline.

#### Scenario: Dimension coverage analysis
- **WHEN** the agent collected extractions across multiple dimensions
- **THEN** the ANALYSIS block shows a visual histogram per dimension with counts and check/warning indicators

### Requirement: Distill phase logging
The system SHALL log the entire distillation pipeline in the same log file, after the capture ANALYSIS block.

#### Scenario: Distill start recorded
- **WHEN** distillation begins with model "qwen/qwen3-235b", 47 total chunks, 47 sampled chunks
- **THEN** the log contains a DISTILL section header with model, total chunks, and sampled chunks

#### Scenario: Batch LLM calls recorded
- **WHEN** identity extraction runs 7 batches with batch 3 taking 2300ms and producing 1234 chars
- **THEN** the log contains `[BATCH 3/7] identity → 1234 chars (2300ms)`

#### Scenario: Merge calls recorded
- **WHEN** identity merge combines 7 batch results in 1500ms producing 2800 chars
- **THEN** the log contains `[MERGE] identity: 7 batches → 2800 chars (1500ms)`

#### Scenario: File generation recorded
- **WHEN** distillation generates soul files
- **THEN** the log contains a generate section listing each file path (e.g., `soul/identity.md`, `soul/behaviors/honor-code.md`)

#### Scenario: Distill result summary
- **WHEN** distillation completes with identity 2800 chars, style 2100 chars, 5 behaviors in 53100ms
- **THEN** the log contains a DISTILL RESULT block with all these values

### Requirement: Logger lifecycle spans capture and distill
The `AgentLogger` instance SHALL be created in `captureSoul`, returned via `CaptureResult.agentLog`, and closed only after distillation completes (or immediately if no distillation occurs).

#### Scenario: Logger passed through to distill
- **WHEN** capture completes successfully and distillation starts
- **THEN** the same log file contains both capture and distill sections

#### Scenario: Logger closed on unknown entity
- **WHEN** capture returns UNKNOWN_ENTITY (no distillation)
- **THEN** the logger is closed immediately by the caller

### Requirement: Graceful failure on logger errors
The system SHALL NOT let logging failures crash the agent loop or distillation. If AgentLogger construction fails, the system SHALL fall back to a warning in the global `debug.log` and continue without per-session logging.

#### Scenario: Log directory creation fails
- **WHEN** `~/.soulkiller/logs/agent/` cannot be created
- **THEN** a warning is logged to global `debug.log`, processing continues without per-session logging
