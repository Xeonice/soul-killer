## ADDED Requirements

### Requirement: Relic load animation plays on soul switch
When a soul is loaded via /use, the system SHALL play a Relic activation animation before transitioning to the RELIC prompt.

#### Scenario: /use triggers animation
- **WHEN** user executes `/use 强尼银手` and the soul exists locally
- **THEN** a 4-phase animation plays: neural link → heartbeat activation → relic status sync → soul info display
- **AND** after animation completes, the prompt changes to RELIC mode

### Requirement: Animation Phase 1 — Neural Link
The animation SHALL display a "establishing neural link..." message with glitch effects for ~0.5s.

#### Scenario: Neural link phase
- **WHEN** the animation starts
- **THEN** text "establishing neural link..." appears with cyan glitch flicker

### Requirement: Animation Phase 2 — Heartbeat Activation
The animation SHALL show a heartbeat line transitioning from flatline to active, with RELIC STATUS progress bar.

#### Scenario: Heartbeat activates
- **WHEN** Phase 2 starts
- **THEN** a HeartbeatLine renders with health transitioning from 0 to 1
- **AND** color transitions from dim → magenta → cyan
- **AND** RELIC STATUS bar fills from 0% to 100%

### Requirement: Animation Phase 3 — Soul Info Display
The animation SHALL display the loaded soul's metadata.

#### Scenario: Soul info shown
- **WHEN** Phase 3 starts
- **THEN** the soul name, memory count, and languages are displayed from manifest.json

### Requirement: Animation Phase 4 — Transition
The animation SHALL display a tagline and transition to REPL.

#### Scenario: Transition complete
- **WHEN** Phase 4 completes
- **THEN** onComplete callback is invoked
- **AND** the REPL prompt is in RELIC mode

### Requirement: Animation uses seeded randomness
The animation SHALL use the GlitchEngine with SOULKILLER_SEED for reproducible test output.

#### Scenario: Deterministic animation
- **WHEN** SOULKILLER_SEED=42 is set
- **THEN** the glitch effects in Phase 1 produce identical output across runs
