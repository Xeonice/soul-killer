## ADDED Requirements

### Requirement: TrueColor Gradient Highlight Bar

The system SHALL render a "BOOTING..." text element with an ANSI TrueColor (24-bit) gradient background. The gradient MUST transition from DARK (#440011) at the edges through PRIMARY (#FF3333) to ACCENT (#FFAAAA) at the center, creating a glow effect.

#### Scenario: Highlight Bar Renders in Phase 1

- **WHEN** Phase 1 of the boot sequence reaches the "BOOTING..." step
- **THEN** a full-width bar renders with "BOOTING..." text
- **THEN** the bar background color transitions smoothly from #440011 → #FF3333 → #FFAAAA → #FF3333 → #440011 across the terminal width
- **THEN** the text foreground uses a contrasting dark color for readability

#### Scenario: Gradient Uses Per-Character Coloring

- **WHEN** the highlight bar renders
- **THEN** each character position in the bar has a unique background color calculated by interpolating the gradient stops based on horizontal position
- **THEN** the gradient uses `\x1b[48;2;R;G;Bm` ANSI TrueColor escape sequences
