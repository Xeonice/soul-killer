# Cyberpunk Visual System

Cyberpunk 2077 styled terminal visual system providing boot/exit animations, themed prompt, SOUL_RECALL display panel, malfunction error rendering, glitch engine, and CRT scanline effects.

## ADDED Requirements

### Requirement: Boot Animation Sequence

The system SHALL render a 3-phase boot animation when the REPL starts. Phase 1 (hex matrix glitch) MUST display randomized hexadecimal characters cascading across the terminal for approximately 1 second. Phase 2 (logo formation) MUST assemble the SOULKILLER logo from glitch fragments over approximately 1.5 seconds. Phase 3 (system init) MUST display sequential system initialization lines (engine status, model loaded, chunk count) over approximately 1 second. The color palette MUST use cyan `#00F7FF`, magenta `#ED1E79`, yellow `#F3E600`, red `#880425`, and background `#181818`.

#### Scenario: Normal Boot

- WHEN the user launches the REPL
- THEN the terminal displays Phase 1 hex matrix glitch for ~1s
- THEN Phase 2 logo formation assembles the SOULKILLER logo over ~1.5s
- THEN Phase 3 system init prints engine mode, model, and chunk count over ~1s
- THEN the prompt becomes interactive

#### Scenario: Boot With Seeded PRNG

- WHEN the environment variable `SOULKILLER_SEED` is set to a fixed value
- THEN the hex matrix glitch pattern in Phase 1 is identical across runs with the same seed

### Requirement: Exit Animation Sequence

The system SHALL render a 4-phase exit animation when the user quits. Phase 1 (state save) MUST display a brief "saving soulstate..." message. Phase 2 (heartbeat decay) MUST render an ECG waveform that progressively flattens, with color transitioning from cyan to magenta to red to dim. Phase 3 (flatline) MUST hold a flat ECG line for a brief moment. Phase 4 (glitch dissolve + CRT off) MUST dissolve the screen content with glitch artifacts and simulate a CRT monitor powering off (shrinking to a horizontal line, then a dot, then nothing).

#### Scenario: User Quits Via /quit

- WHEN the user enters the `/quit` command
- THEN Phase 1 displays "saving soulstate..." with a brief pause
- THEN Phase 2 renders an ECG waveform decaying from normal to flat, color shifting cyan -> magenta -> red -> dim
- THEN Phase 3 holds a flatline for ~0.5s
- THEN Phase 4 dissolves the screen with glitch artifacts and CRT-off effect
- THEN the process exits

#### Scenario: Exit With Ctrl+C

- WHEN the user presses Ctrl+C
- THEN the exit animation plays in an accelerated form (total ~1.5s)
- THEN the process exits

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
