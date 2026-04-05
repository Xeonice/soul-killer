# Soulkiller Protocol Panel

## ADDED Requirements

### Requirement: Panel visual identity

The panel SHALL display with a Cyberpunk-themed visual style.

#### Scenario: Panel rendering

- WHEN the Soulkiller Protocol panel is displayed
- THEN it MUST render with a cyan border
- THEN it MUST display the title "SOULKILLER PROTOCOL" in magenta

---

### Requirement: Phase 1 - Initiation

The panel SHALL display an initiation phase with glitch effects.

#### Scenario: Protocol initiation display

- WHEN the soul capture agent begins execution
- THEN the panel MUST display "initiating soul capture..." text
- THEN the text MUST render with a glitch visual effect

---

### Requirement: Phase 2 - Target info reveal

The panel SHALL reveal target information line by line.

#### Scenario: Target information display

- WHEN the agent has identified and classified the target
- THEN the panel MUST display the following lines one by one:
  - Target name
  - Classification (DIGITAL_CONSTRUCT, PUBLIC_ENTITY, or HISTORICAL_RECORD)
  - Origin (source context of the target)

#### Scenario: Sequential line appearance

- WHEN target info lines are displayed
- THEN each line SHALL appear sequentially, not all at once

---

### Requirement: Phase 3 - Extraction progress

The panel SHALL show real-time progress for each agent extraction step.

#### Scenario: Step progress with spinner

- WHEN an agent extraction step is currently running
- THEN the panel MUST display the step label with an animated spinner using the sequence: ⠋ ⠙ ⠹ ⠸ ⠼ ⠴ ⠦ ⠧ ⠇ ⠏

#### Scenario: Step completion indicator

- WHEN an agent extraction step completes
- THEN the spinner MUST be replaced with a ✓ checkmark

#### Scenario: Step labels

- WHEN extraction steps are displayed
- THEN the step labels MUST be:
  - "core identity"
  - "behavioral signatures"
  - "dialogue fragments"
  - "personality matrix"

---

### Requirement: Phase 4 - Completion

The panel SHALL display a completion summary after all extraction steps finish.

#### Scenario: Completion display

- WHEN all extraction steps have completed
- THEN the panel MUST display "soul fragments captured: N" where N is the total number of SoulChunks extracted
- THEN the panel MUST display the total extraction time

---

### Requirement: UNKNOWN_ENTITY malfunction display

The panel SHALL display a distinct malfunction-style output for UNKNOWN_ENTITY targets.

#### Scenario: Unknown entity display

- WHEN the target is classified as UNKNOWN_ENTITY
- THEN the panel MUST display "MANUAL EXTRACTION REQUIRED" in a malfunction visual style
- THEN the panel MUST display "target not found in cyberspace"
- THEN the panel MUST display "provide raw neural data to proceed"

---

### Requirement: Deterministic glitch engine

The panel SHALL use a seeded GlitchEngine for deterministic output in tests.

#### Scenario: Seeded glitch output

- WHEN the GlitchEngine is initialized with a seed value
- THEN all glitch effects MUST produce identical output for the same seed
- THEN test assertions can rely on deterministic rendered text
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

### Requirement: Panel shows realtime tool call progress
The Soulkiller Protocol Panel SHALL display each tool call in real-time as the agent executes.

#### Scenario: Search query displayed
- **WHEN** the agent starts a search tool call
- **THEN** the panel shows "searching: {query}" with a spinner

#### Scenario: Search result count displayed
- **WHEN** a search tool call completes
- **THEN** the panel updates to show "found N results" and the spinner changes to ✓

#### Scenario: Multiple tool calls shown sequentially
- **WHEN** the agent makes 4 search calls
- **THEN** each call is shown as a separate line in the extraction section with its query and status

---

### Requirement: Panel displays search plan dimensions
The protocol panel SHALL display a dimension priority indicator after classification is revealed, showing each of the 6 dimensions with a visual marker for its priority level.

#### Scenario: Dimensions shown after classification
- **WHEN** the panel has classification and searchPlan data
- **THEN** a dimension line is rendered showing all 6 dimensions with ● (required) ◐ (important) ○ (supplementary) indicators
