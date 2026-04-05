## MODIFIED Requirements

### Requirement: Panel displays search plan dimensions
The protocol panel SHALL display a dimension priority indicator after classification is revealed, showing each of the 6 dimensions with a visual marker for its priority level.

#### Scenario: Dimensions shown after classification
- **WHEN** the panel has classification and searchPlan data
- **THEN** a dimension line is rendered showing all 6 dimensions with ● (required) ◐ (important) ○ (supplementary) indicators
