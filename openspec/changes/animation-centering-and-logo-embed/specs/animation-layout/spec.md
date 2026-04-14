## ADDED Requirements

### Requirement: Shared CenteredStage container

The system SHALL provide a shared `CenteredStage` React component as the single canonical outer container for all full-screen animations. `CenteredStage` MUST center its content column horizontally on the terminal (`alignItems="center"` on the outer Box with `width={termWidth}`) and MUST also center each row of content inside that column (`alignItems="center"` on the inner Box with `width={contentWidth}`). The `contentWidth` constant MUST be computed as `Math.min(130, termWidth - 4)` where `termWidth = process.stdout.columns ?? 80`. Both `CenteredStage` and `contentWidth` MUST be exported from `src/cli/animation/layout.tsx`.

#### Scenario: Animation renders centered on wide terminal

- WHEN the terminal width is 200 columns
- THEN `contentWidth` is 130
- THEN the content column is padded with `(200 - 130) / 2 = 35` columns of space on each side
- THEN all text rows inside the column are horizontally centered within that 130-column area

#### Scenario: Animation renders centered on narrow terminal

- WHEN the terminal width is 90 columns
- THEN `contentWidth` is 86 (90 - 4)
- THEN the outer Box fills the terminal, the inner Box is 86 columns wide, text is centered within it

#### Scenario: CenteredStage used by all full-screen animations

- WHEN any of BootAnimation, ExitAnimation, BatchProtocolPanel, ExportProtocolPanel, RelicLoadAnimation, SoulkillerProtocolPanel renders
- THEN the root element of that component is `CenteredStage`
- THEN no hardcoded `paddingLeft` or leading-space strings are used for alignment

### Requirement: ANSI-aware centering for logo lines

When centering lines that contain ANSI escape sequences (such as the Arasaka logo ANS art), the system SHALL derive the visual width of each line by stripping ANSI escapes before measuring. If ink's flexbox aligns the logo incorrectly due to escape-sequence length inflation, the logo lines MUST be manually padded with leading spaces calculated as `Math.max(0, Math.floor((contentWidth - visibleWidth(line)) / 2))`.

#### Scenario: Logo line centered correctly on 130-column terminal

- WHEN the ANS logo line has visible width 128 and raw `.length` 180 (due to ANSI escapes)
- THEN the manual leading-space padding is `Math.floor((130 - 128) / 2) = 1` space
- THEN the line renders centered rather than shifted left by escape-sequence count

#### Scenario: Fallback text logo centered correctly

- WHEN terminal width < 130 and the fallback `FALLBACK_LOGO` text lines are used
- THEN the same CenteredStage `alignItems="center"` is sufficient (no ANSI escapes in fallback)
- THEN no manual padding is applied

### Requirement: Compiled binary must embed ARASAKA logo asset

The ARASAKA logo ANS art (`assets/logo-red-130-r08.ans`) MUST be embedded into the compiled binary via Bun's native text import (`import logoAns from '...' with { type: 'text' }`). The system MUST NOT use `readFileSync` or any runtime filesystem path construction to load the logo. The `loadArasakaLogo` function MUST split the inlined string by newlines and return the lines directly. The `catch`/fallback branch MUST only exist for the terminal-width guard (width < 130 → use `FALLBACK_LOGO`), not for filesystem errors.

#### Scenario: Logo available in compiled binary

- WHEN soulkiller is compiled with `bun build --compile` and executed on a machine without the source tree
- THEN the boot animation and exit animation display the full ANSI art Arasaka logo (not the FALLBACK_LOGO text box)
- THEN no filesystem access is attempted for the logo asset

#### Scenario: Logo falls back to text on narrow terminal

- WHEN terminal width is less than 130 columns (regardless of binary or dev mode)
- THEN `FALLBACK_LOGO` text lines are used
- THEN no error is thrown
