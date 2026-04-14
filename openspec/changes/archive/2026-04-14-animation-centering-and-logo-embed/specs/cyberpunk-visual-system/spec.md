## MODIFIED Requirements

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
