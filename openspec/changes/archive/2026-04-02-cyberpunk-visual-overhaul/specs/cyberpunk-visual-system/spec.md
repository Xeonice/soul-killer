## MODIFIED Requirements

### Requirement: Boot Animation Sequence

The system SHALL render a 4-phase boot animation when the REPL starts. Phase 1 (BIOS Boot) MUST display Arasaka/Soulkiller branding with typewriter effect, a TrueColor gradient "BOOTING..." bar, and system information lines for 5-10 seconds. Phase 2 (Hex Data Waterfall) MUST scroll hexadecimal address lines with Morse-like separators for 10-15 seconds. Phase 3 (Arasaka Panel) MUST display the ANSI art Arasaka logo, device information with Japanese labels, and a progress bar for 3-5 seconds. Phase 4 (Ready) MUST flash a CRT scanline, clear the screen, and enable the interactive prompt. The color palette MUST use PRIMARY `#FF3333`, ACCENT `#FFAAAA`, DIM `#882222`, DARK `#440011`, WARNING `#F3E600`, and background `#080808`.

#### Scenario: Normal Boot

- **WHEN** the user launches the REPL
- **THEN** Phase 1 displays BIOS boot text with typewriter effect for 5-10s
- **THEN** Phase 2 scrolls hex data waterfall for 10-15s
- **THEN** Phase 3 displays Arasaka panel with logo and progress bar for 3-5s
- **THEN** Phase 4 flashes CRT scanline and clears to interactive prompt

#### Scenario: Boot With Seeded PRNG

- **WHEN** the environment variable `SOULKILLER_SEED` is set to a fixed value
- **THEN** the hex data waterfall pattern in Phase 2 is identical across runs with the same seed

### Requirement: Color Palette

The visual system SHALL use a red monochrome color scheme. PRIMARY (`#FF3333`) MUST be used for main text, active states, and the Arasaka logo. ACCENT (`#FFAAAA`) MUST be used for emphasis and selected items. DIM (`#882222`) MUST be used for secondary information and muted text. DARK (`#440011`) MUST be used for borders and background elements. WARNING (`#F3E600`) MUST be used exclusively for warning messages. Background MUST be `#080808`.

#### Scenario: All Components Use Red Monochrome Palette

- **WHEN** any visual component renders
- **THEN** the component uses only colors from the defined palette (PRIMARY, ACCENT, DIM, DARK, WARNING, BG)
- **THEN** no cyan (#00F7FF) or magenta (#ED1E79) colors appear anywhere in the UI

### Requirement: Exit Animation Sequence

The system SHALL render a 4-phase exit animation when the user quits. Phase 1 (state save) MUST display a brief "saving soulstate..." message in DIM red. Phase 2 (heartbeat decay) MUST render an ECG waveform that progressively flattens, with color transitioning from PRIMARY to DIM to DARK. Phase 3 (flatline) MUST hold a flat ECG line in DARK red for a brief moment. Phase 4 (glitch dissolve + CRT off) MUST dissolve the screen content with glitch artifacts and simulate a CRT monitor powering off.

#### Scenario: User Exits Via /exit

- **WHEN** the user enters the `/exit` command
- **THEN** Phase 1 displays "saving soulstate..." in DIM red with a brief pause
- **THEN** Phase 2 renders an ECG waveform decaying from normal to flat, color shifting PRIMARY → DIM → DARK
- **THEN** Phase 3 holds a flatline in DARK red for ~0.5s
- **THEN** Phase 4 dissolves the screen with glitch artifacts and CRT-off effect
- **THEN** the process exits

#### Scenario: Exit With Ctrl+C

- **WHEN** the user presses Ctrl+C
- **THEN** the exit animation plays in an accelerated form (total ~1.5s)
- **THEN** the process exits

### Requirement: Relic-Style Dynamic Prompt

The system SHALL display a cyberpunk-themed prompt that reflects the current session state. When no soul is loaded, the prompt MUST be `◈ soul://void >`. When the user's own soul is loaded, the prompt MUST be `◈ soul://name >` where `name` is the soul name. When another person's soul is loaded via relic, the prompt MUST be `◈ soul://name [RELIC] >`. The prompt MUST use PRIMARY red for the prompt symbol and soul path, DIM red for brackets and status labels, and ACCENT for the active status indicator. The prompt MUST support dynamic state suffixes: `[RECALL]` during recall operations, `[STREAMING]` during LLM streaming, and `[MALFUNCTION]` during error states.

#### Scenario: No Soul Loaded

- **WHEN** the REPL starts and no soul has been ingested or loaded
- **THEN** the prompt displays `◈ soul://void >` in PRIMARY red

#### Scenario: Relic Soul Loaded

- **WHEN** the user loads another person's soul named "johnny"
- **THEN** the prompt displays `◈ soul://johnny [RELIC] >` with [RELIC] in DIM red

### Requirement: Malfunction Error Display

The system SHALL display error messages with severity-appropriate styling using the red monochrome palette. Warning severity MUST use WARNING (#F3E600) border. Malfunction severity MUST use PRIMARY (#FF3333) border with glitch effect. Critical severity MUST use ACCENT (#FFAAAA) border with extended glitch effect and "CRITICAL" ASCII header.

#### Scenario: Critical Error Display

- **WHEN** a critical error occurs during soul operations
- **THEN** the error panel renders with an ACCENT (#FFAAAA) border
- **THEN** the "CRITICAL" ASCII header renders in PRIMARY red
- **THEN** the error message displays with a 1-second glitch decay effect

### Requirement: Heartbeat Line Health Visualization

The HeartbeatLine component SHALL use the red monochrome palette for health status indication. Health above 0.6 MUST render in PRIMARY (#FF3333) with a fast heartbeat pattern. Health between 0.3 and 0.6 MUST render in DIM (#882222) with a weaker pattern. Health below 0.3 MUST render in DARK (#440011) with a failing pattern. Health at 0 MUST render a flatline in DIM (#882222).

#### Scenario: Healthy Heartbeat

- **WHEN** the heartbeat line renders with health > 0.6
- **THEN** the ECG pattern displays in PRIMARY (#FF3333) with a fast rhythm

#### Scenario: Flatline

- **WHEN** the heartbeat line renders with health = 0
- **THEN** a flat line displays in DIM (#882222)

### Requirement: Conversation View Colors

The ConversationView SHALL use the red monochrome palette. User messages MUST be prefixed with `❯` in DIM (#882222). Assistant messages MUST display the soul name in PRIMARY (#FF3333) bold and message content in ACCENT (#FFAAAA). Separator lines MUST use DARK (#440011). The thinking indicator MUST use DIM (#882222) with a braille spinner.

#### Scenario: User and Assistant Messages

- **WHEN** the conversation view renders a user message followed by an assistant response
- **THEN** the user message prefix `❯` renders in DIM red
- **THEN** the assistant soul name renders in PRIMARY red bold
- **THEN** the assistant message content renders in ACCENT red
- **THEN** a DARK red separator line appears between conversation turns
