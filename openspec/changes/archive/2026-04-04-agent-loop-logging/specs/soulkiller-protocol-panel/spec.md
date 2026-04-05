## MODIFIED Requirements

### Requirement: Protocol panel displays tool calls grouped by agent phase
The protocol panel SHALL group tool calls by their agent phase (searching/classifying/analyzing) and render each group under a phase header with a completion indicator.

#### Scenario: Three-phase display
- **WHEN** the agent has completed reconnaissance (2 searches), planning (1 planSearch), and is collecting (3 searches + 1 checkCoverage)
- **THEN** the panel shows three phase groups: "阶段一：目标侦察 ✓", "阶段二：目标分析 ✓", "阶段三：深度采集 ⠹" with their respective tool calls nested underneath

#### Scenario: Tool-specific icons
- **WHEN** tool calls are rendered
- **THEN** search uses 🔍, extractPage uses 📄, planSearch uses 📋, checkCoverage uses 📊

### Requirement: ToolCallDisplay carries phase information
The `ToolCallDisplay` interface SHALL include an optional `phase` field of type `AgentPhase` so tool calls can be grouped by phase.

#### Scenario: Phase tagged on tool call
- **WHEN** a tool call event occurs during the "analyzing" phase
- **THEN** the tool call is added to state with `phase: 'analyzing'`
