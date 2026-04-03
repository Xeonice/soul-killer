## ADDED Requirements

### Requirement: 4-Phase Arasaka Boot Sequence

The system SHALL render a 4-phase boot animation when the REPL starts, with a total duration of 15-25 seconds.

#### Scenario: Phase 1 - BIOS Boot

- **WHEN** the REPL starts
- **THEN** the terminal displays "ARASAKA" and "SOULKILLER PROTOCOL v{version}" in PRIMARY red
- **THEN** a "//" separator line appears
- **THEN** a "BOOTING..." TrueColor gradient highlight bar renders across the terminal width
- **THEN** system information lines appear one by one with typewriter effect (50-100ms per character):
  - "NEURAL INTERFACE BOOT"
  - "//"
  - "LOADING KERNEL............"
  - "PARTITION TOOLS"
  - "SOUL ENGINE - X64"
  - "CONSOLE MODE (1)"
- **THEN** a blinking cursor (█) appears at the end of the last line
- **THEN** Phase 1 completes after 5-10 seconds

#### Scenario: Phase 2 - Hex Data Waterfall

- **WHEN** Phase 1 completes
- **THEN** the terminal begins scrolling hexadecimal address lines (e.g., "9A2ADD926BDFC  -  387E515B1C2E9  -  311DA36743758")
- **THEN** alternating lines display Morse-like separator patterns (e.g., "-/…././-.--/---/..-/")
- **THEN** scroll speed increases progressively from 200ms to 50ms per line
- **THEN** all hex data lines render in PRIMARY (#FF3333) red
- **THEN** Phase 2 completes after 10-15 seconds

#### Scenario: Phase 3 - Arasaka Panel

- **WHEN** Phase 2 completes
- **THEN** the terminal clears and displays the ANSI art Arasaka logo (loaded from assets file)
- **THEN** a device information panel appears with Japanese elements:
  - "ソウルキラー端末"
  - "[荒坂産業]"
  - "DEVICE: CLI_TERMINAL"
  - "STATUS: ONLINE"
  - "ENGINE: {detected engine type}"
  - "CURRENT_USER: ********"
- **THEN** a progress bar panel with double-line border (╔═╗) renders below
  - "< SYSTEM INITIALIZING >"
  - "SOULKILLER VER {version} BOOT"
  - Progress bar fills from 0% to 100% over 2-3 seconds
- **THEN** "POWER_BY ARASAKA ⊕" appears at the bottom
- **THEN** Phase 3 completes after 3-5 seconds

#### Scenario: Phase 4 - Ready

- **WHEN** Phase 3 completes
- **THEN** a CRT scanline effect flashes briefly
- **THEN** the terminal clears
- **THEN** the interactive prompt becomes available

### Requirement: Boot Sequence Uses Seeded PRNG

The hex data waterfall in Phase 2 SHALL use the existing GlitchEngine PRNG for generating hexadecimal data. When the `SOULKILLER_SEED` environment variable is set, the hex data output MUST be identical across runs.

#### Scenario: Deterministic Hex Waterfall

- **WHEN** the environment variable `SOULKILLER_SEED` is set to "42"
- **THEN** Phase 2 hex data lines are identical across multiple runs

### Requirement: Boot Sequence Japanese Elements

The boot sequence SHALL include Japanese text elements to reinforce the Arasaka corporate identity. The Japanese elements MUST include "ソウルキラー端末" (Soulkiller Terminal) and "[荒坂産業]" (Arasaka Industries).

#### Scenario: Japanese Labels in Arasaka Panel

- **WHEN** Phase 3 renders the device information panel
- **THEN** the panel header displays "ソウルキラー端末" in PRIMARY red
- **THEN** the panel sub-header displays "[荒坂産業]" in PRIMARY red
