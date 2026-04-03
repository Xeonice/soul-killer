## ADDED Requirements

### Requirement: ANSI Art Arasaka Logo Asset

The system SHALL include a pre-generated ANSI art file of the Arasaka logo at `assets/logo-red-130-r08.ans`. The logo MUST be 130 terminal columns wide and 26 terminal rows high, rendered using half-block characters (▄▀█) with ANSI TrueColor escape sequences in #FF3333 red on transparent background.

#### Scenario: Logo File Exists and Is Valid

- **WHEN** the application starts
- **THEN** the file `assets/logo-red-130-r08.ans` exists and contains valid ANSI escape sequences
- **THEN** the logo renders the Arasaka circular emblem (three-petal motif) above the stylized "ARASAKA" text

### Requirement: Logo Loading With Fallback

The boot animation SHALL load the ANSI art logo from the assets file at runtime. If the file cannot be read, the system SHALL fall back to a simple text-based "ARASAKA" header without crashing.

#### Scenario: Logo File Missing

- **WHEN** Phase 3 of the boot sequence attempts to load the logo
- **THEN** if `assets/logo-red-130-r08.ans` is not found, the system displays "ARASAKA" in PRIMARY red as plain text
- **THEN** the boot sequence continues normally

### Requirement: Terminal Width Adaptation

The boot animation SHALL detect the terminal width before rendering the logo. If the terminal is narrower than 130 columns, the system SHALL skip the ANSI art logo and display a compact text fallback instead.

#### Scenario: Narrow Terminal

- **WHEN** the terminal width is less than 130 columns
- **THEN** the Arasaka logo ANSI art is not rendered
- **THEN** a compact "ARASAKA" text header in PRIMARY red is displayed instead
