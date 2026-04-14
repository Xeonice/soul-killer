# Cyberpunk Visual System

Cyberpunk 2077 styled terminal visual system providing boot/exit animations, themed prompt, SOUL_RECALL display panel, malfunction error rendering, glitch engine, and CRT scanline effects.

## ADDED Requirements

### Requirement: Boot Animation Sequence

The system SHALL render a multi-phase boot animation when the REPL starts. The entire animation MUST be rendered inside a `CenteredStage` container (see `animation-layout` capability) so that the content column is horizontally centered in the terminal and all rows inside the column are centered within it. The ARASAKA logo displayed during the panel phase MUST be the embedded ANS art logo (loaded via Bun text import), not a fallback text box, when terminal width is ≥ 130 columns. No hardcoded leading spaces or `paddingLeft` props MUST be used for alignment purposes — all alignment is delegated to `CenteredStage`. The color palette MUST use cyan `#00F7FF`, magenta `#ED1E79`, yellow `#F3E600`, red `#880425`, and background `#181818`.

#### Scenario: Normal Boot

- WHEN the user launches the REPL
- THEN the boot animation renders centered in the terminal
- THEN all content (BIOS lines, waterfall hex, logo, panel info) is visually centered within the content column
- THEN the prompt becomes interactive after animation completes

#### Scenario: Boot With Seeded PRNG

- WHEN the environment variable `SOULKILLER_SEED` is set to a fixed value
- THEN the hex matrix glitch pattern is identical across runs with the same seed

#### Scenario: Logo renders as ANS art in compiled binary

- WHEN soulkiller is compiled and executed on a terminal ≥ 130 columns wide
- THEN the panel phase shows the full ANSI art Arasaka logo
- THEN no "A R A S A K A" text fallback box is shown

#### Scenario: Logo falls back to text on narrow terminal

- WHEN terminal width is less than 130 columns
- THEN the boot animation uses the FALLBACK_LOGO text lines
- THEN the animation still renders centered via CenteredStage

### Requirement: Exit Animation Sequence

The system SHALL render a multi-phase exit animation when the user quits. The entire animation MUST be rendered inside a `CenteredStage` container so content is horizontally centered. The ARASAKA logo dissolution phase MUST use the embedded ANS art logo when terminal width ≥ 130 columns. No hardcoded leading spaces or `paddingLeft` props MUST be used for alignment. The animation phases (logo annihilation, shutdown steps, data collapse, final message) are each visually centered within the content column.

#### Scenario: User Exits Via /exit

- WHEN the user enters the `/exit` command
- THEN the exit animation renders centered in the terminal
- THEN the logo annihilation, shutdown steps, and data collapse are all centered within the content column
- THEN the process exits after animation completes

#### Scenario: Exit With Ctrl+C

- WHEN the user presses Ctrl+C
- THEN the exit animation plays and remains centered
- THEN the process exits

#### Scenario: Exit logo renders as ANS art in compiled binary

- WHEN soulkiller is compiled and executed on a terminal ≥ 130 columns wide
- THEN the logo dissolution phase dissolves the full ANSI art logo
- THEN no text fallback box is shown during the exit animation

### Requirement: Relic-Style Dynamic Prompt

The system SHALL display a cyberpunk-themed prompt that reflects the current session state. When no soul is loaded, the prompt MUST be `◈ soul://void >`. When the user's own soul is loaded, the prompt MUST be `◈ soul://name >` where `name` is the soul name. When another person's soul is loaded via relic, the prompt MUST be `◈ soul://name [RELIC] >`. The prompt MUST support dynamic state suffixes: `[RECALL]` during recall operations, `[STREAMING]` during LLM streaming, and `[MALFUNCTION]` during error states.

#### Scenario: No Soul Loaded

- WHEN the REPL starts and no soul has been ingested or loaded
- THEN the prompt displays `◈ soul://void >`

#### Scenario: Own Soul Loaded

- WHEN the user ingests their own data and loads the soul named "tang"
- THEN the prompt displays `◈ soul://tang >`

#### Scenario: Relic Soul Loaded

- WHEN the user loads another person's soul named "johnny"
- THEN the prompt displays `◈ soul://johnny [RELIC] >`

#### Scenario: Streaming State

- WHEN the LLM is actively streaming a response
- THEN the prompt temporarily changes to show `[STREAMING]` suffix

### Requirement: SOUL_RECALL Display Panel

The system SHALL render a bordered panel when displaying soul recall (vector search) results. The panel border MUST be cyan `#00F7FF`. The panel label MUST be magenta `#ED1E79` and read "SOUL_RECALL". Each result MUST display an animated similarity bar showing the match score. The panel MUST auto-collapse (shrink to a single summary line) after results have been displayed for a configurable duration.

#### Scenario: Recall Results Displayed

- WHEN the conversation engine performs a recall query and returns 3 matching chunks
- THEN a cyan-bordered panel labeled "SOUL_RECALL" in magenta appears
- THEN each chunk shows its source, a snippet, and an animated similarity bar filling to its score percentage
- THEN after display, the panel collapses to a single line summary (e.g., "3 memories recalled, top: 0.92")

#### Scenario: No Recall Results

- WHEN a recall query returns zero matching chunks
- THEN the panel briefly flashes with the text "NO MEMORY TRACE FOUND" and disappears

### Requirement: Malfunction Error Display

The system SHALL render errors in 3 severity levels with distinct visual treatments. WARNING level MUST use yellow `#F3E600` text with a minor screen flash. MALFUNCTION level MUST use magenta `#ED1E79` text with glitch-distorted characters. CRITICAL level MUST use red `#880425` with a full-screen glitch storm effect including ASCII art corruption patterns.

#### Scenario: Warning Level Error

- WHEN a non-fatal error occurs (e.g., slow network response)
- THEN the terminal displays the error message in yellow with a brief screen flash
- THEN normal operation continues

#### Scenario: Malfunction Level Error

- WHEN a recoverable error occurs (e.g., model API returned 500)
- THEN the terminal displays the error message in magenta with glitch-distorted text characters
- THEN the system suggests a recovery action

#### Scenario: Critical Level Error

- WHEN a fatal error occurs (e.g., engine connection lost)
- THEN the terminal fills with a red glitch storm effect including ASCII art corruption
- THEN the error message is displayed prominently in the center
- THEN the system either attempts auto-recovery or prompts the user for action

### Requirement: Seeded Glitch Engine

The system SHALL use a seeded pseudo-random number generator (PRNG) for all glitch and animation effects. When the `SOULKILLER_SEED` environment variable is set, the PRNG MUST be initialized with that seed value, producing identical animation sequences across runs. When `SOULKILLER_SEED` is not set, the system MUST use true random (e.g., `Math.random()` or crypto random) for visual variety.

#### Scenario: Reproducible Animations for Testing

- WHEN `SOULKILLER_SEED=42` is set in the environment
- THEN all glitch patterns, hex matrix characters, and animation timings are deterministic
- THEN running the boot animation twice produces identical output

#### Scenario: Random Animations in Production

- WHEN `SOULKILLER_SEED` is not set
- THEN each boot animation produces visually different glitch patterns
- THEN no two runs are identical

### Requirement: CRT Scanline Effect

The system SHALL render a CRT scanline overlay effect consisting of a horizontal bright line that sweeps vertically across the terminal output. The scanline MUST be subtle enough not to interfere with readability but visible enough to reinforce the retro-futuristic aesthetic. The effect MUST be active during boot animation, exit animation, and error displays.

#### Scenario: Scanline During Boot

- WHEN the boot animation is playing
- THEN a horizontal bright line sweeps from top to bottom of the terminal
- THEN the sweep repeats at a consistent interval throughout the animation

#### Scenario: Scanline Disabled During Normal Input

- WHEN the user is typing at the prompt or reading a response
- THEN the CRT scanline effect is not active to avoid distraction

### Requirement: Animation text supports multilingual display

Boot and exit animations SHALL display text in the user's configured language while preserving the cyberpunk aesthetic.

#### Scenario: Boot animation in Chinese

- **WHEN** language is `zh`
- **THEN** boot animation panel shows `灵魂杀手终端 · [荒坂工业]`

#### Scenario: Boot animation in Japanese

- **WHEN** language is `ja`
- **THEN** boot animation panel shows `ソウルキラー端末 · [荒坂産業]`

#### Scenario: Boot animation in English

- **WHEN** language is `en`
- **THEN** boot animation panel shows `SOULKILLER TERMINAL · [ARASAKA IND.]`

#### Scenario: Exit animation disconnect message

- **WHEN** the exit animation plays
- **THEN** the disconnect status text SHALL be in the user's configured language
