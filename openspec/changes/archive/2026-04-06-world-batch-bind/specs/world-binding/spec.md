## MODIFIED Requirements

### Requirement: Reverse lookup of souls bound to a world
The binding module SHALL provide a function to find all souls that have a binding file for a given world name.

#### Scenario: Find bound souls
- **WHEN** `findSoulsBoundToWorld("night-city")` is called and souls "alice" and "charlie" have binding files for "night-city"
- **THEN** the function returns `["alice", "charlie"]`

#### Scenario: No souls bound
- **WHEN** `findSoulsBoundToWorld("empty-world")` is called and no souls have a binding file for "empty-world"
- **THEN** the function returns an empty array

#### Scenario: Includes disabled bindings
- **WHEN** soul "bob" has a binding file for "night-city" with `enabled: false`
- **THEN** `findSoulsBoundToWorld("night-city")` includes "bob" in the result
