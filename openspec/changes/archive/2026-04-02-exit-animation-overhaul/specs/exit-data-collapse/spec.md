## ADDED Requirements

### Requirement: Reverse Data Waterfall With Increasing Corruption

The exit animation SHALL display hex data lines that progressively corrupt, symmetrical to the boot animation's hex waterfall. Lines MUST be generated using GlitchEngine with increasing glitch intensity over 4 seconds.

#### Scenario: Data Collapse Progression

- **WHEN** Phase 2 of the exit animation begins
- **THEN** hex data lines appear in a scrolling buffer (same format as boot: "HEXADDR - HEXADDR - HEXADDR" and Morse-like separator lines)
- **THEN** during 0-1.5s, lines have glitch intensity 0-0.2 (mostly readable)
- **THEN** during 1.5-3s, lines have glitch intensity 0.3-0.6 (half corrupted)
- **THEN** during 3-4s, lines have glitch intensity 0.7-1.0 (nearly all glitch characters)

### Requirement: Data Collapse Speed Pattern

The data collapse lines SHALL generate at a decelerating rate (opposite of boot acceleration), creating a "system struggling" effect. Line generation interval MUST increase from ~80ms to ~350ms over the phase duration.

#### Scenario: Deceleration Pattern

- **WHEN** Phase 2 starts
- **THEN** initial lines appear rapidly (~80ms apart)
- **THEN** line generation gradually slows to ~350ms apart
- **THEN** the final lines are heavily corrupted and appear sluggishly
