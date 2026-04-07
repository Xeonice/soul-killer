## MODIFIED Requirements

### Requirement: Multi-soul checkbox bind UI
The WorldBindCommand SHALL display a checkbox list of all local souls, with already-bound souls pre-checked. Users toggle checkboxes to bind or unbind souls.

#### Scenario: Display all souls with bind status
- **WHEN** the bind management screen opens for world "night-city" and souls "alice" (bound) and "bob" (unbound) exist locally
- **THEN** the list shows ☑ alice and ☐ bob

#### Scenario: Toggle soul binding on
- **WHEN** the user presses Space on an unchecked soul "bob"
- **THEN** the checkbox toggles to checked (☑ bob)

#### Scenario: Toggle soul binding off
- **WHEN** the user presses Space on a checked soul "alice"
- **THEN** the checkbox toggles to unchecked (☐ alice)

#### Scenario: Confirm applies changes
- **WHEN** the user presses Enter with "alice" unchecked (was bound) and "bob" checked (was unbound)
- **THEN** alice is unbound from the world and bob is bound with default order 0

#### Scenario: No changes made
- **WHEN** the user presses Enter without changing any checkboxes
- **THEN** no binding files are modified and the screen closes

#### Scenario: Cancel discards changes
- **WHEN** the user presses Esc
- **THEN** no binding files are modified and the screen closes

### Requirement: Empty soul list handling
The bind screen SHALL show a message and auto-close when no local souls exist.

#### Scenario: No local souls
- **WHEN** the bind screen opens and no souls exist locally
- **THEN** a message is displayed indicating no souls are available, and the screen returns to the action menu

### Requirement: Bind result summary
After confirming, the system SHALL display a summary of changes made.

#### Scenario: Summary after batch bind
- **WHEN** the user confirms with 2 new binds and 1 unbind
- **THEN** the summary shows "Bound: bob, charlie. Unbound: alice."
