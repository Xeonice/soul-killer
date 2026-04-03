## MODIFIED Requirements

### Requirement: /use command plays Relic animation
The /use command SHALL play the RelicLoadAnimation after loading a soul, before transitioning to the RELIC prompt.

#### Scenario: /use with animation
- **WHEN** user executes `/use douglastang` and the soul exists
- **THEN** the RelicLoadAnimation plays showing soul info
- **AND** after animation completes, the prompt changes to RELIC mode
