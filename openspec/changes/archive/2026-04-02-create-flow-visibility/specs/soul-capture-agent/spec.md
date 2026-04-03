## ADDED Requirements

### Requirement: Search result confirmation before proceeding

After Agent search completes with valid results, the system SHALL pause at a `search-confirm` step to let the user verify the target before continuing.

#### Scenario: Successful search triggers confirmation

- **WHEN** Agent search completes with classification other than UNKNOWN_ENTITY
- **THEN** the system SHALL transition to `search-confirm` step
- **THEN** the system SHALL NOT auto-proceed to data-sources or distillation

#### Scenario: UNKNOWN_ENTITY skips confirmation

- **WHEN** Agent search completes with UNKNOWN_ENTITY classification
- **THEN** the system SHALL transition directly to data-sources step (existing behavior)
