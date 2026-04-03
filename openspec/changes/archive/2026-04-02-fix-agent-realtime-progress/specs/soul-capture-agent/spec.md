## MODIFIED Requirements

### Requirement: Agent uses manual loop with realtime progress
The Soul Capture Agent SHALL use a manual agent loop instead of single generateText, emitting progress for each tool call.

#### Scenario: Each tool call is visible to UI
- **WHEN** the agent calls the search tool
- **THEN** a progress event is emitted with the tool name and search query before execution
- **AND** a progress event is emitted with the result count after execution

#### Scenario: Classification is extracted during loop
- **WHEN** the agent receives search results about the target
- **THEN** the classification is extracted from LLM text output during the loop (not from final JSON)
- **AND** a classification progress event is emitted

#### Scenario: Loop terminates when LLM stops calling tools
- **WHEN** the LLM responds without requesting tool calls
- **THEN** the agent loop exits and returns the accumulated chunks

#### Scenario: Max iterations prevent infinite loop
- **WHEN** the agent has executed 15 loop iterations
- **THEN** the loop exits regardless of LLM behavior
