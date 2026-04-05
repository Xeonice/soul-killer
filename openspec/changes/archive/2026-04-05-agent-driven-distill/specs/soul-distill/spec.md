## MODIFIED Requirements

### Requirement: extractFeatures retained for evolve flow only
The `extractFeatures` function in `extractor.ts` SHALL be retained for the evolve flow but is no longer called by the create flow.

#### Scenario: Evolve still uses extractFeatures
- **WHEN** evolve command runs
- **THEN** it calls `extractFeatures` as before, unaffected by this change
