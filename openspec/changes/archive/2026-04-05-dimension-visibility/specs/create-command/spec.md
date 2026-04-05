## MODIFIED Requirements

### Requirement: Search confirm shows dimension coverage
The search-confirm screen SHALL display a dimension coverage histogram below the fragment count, computed from `agentChunks[].metadata.extraction_step`.

#### Scenario: Coverage histogram displayed
- **WHEN** the search-confirm screen is shown with 47 chunks
- **THEN** a dimension coverage section lists all 6 dimensions with proportional bars and counts

### Requirement: Search detail shows dimension labels
The search-detail screen SHALL display the dimension label for each chunk alongside the source.

#### Scenario: Dimension tag on chunk
- **WHEN** a chunk has `metadata.extraction_step = 'quotes'`
- **THEN** the chunk line shows "web · quotes" before the URL

#### Scenario: No dimension metadata
- **WHEN** a chunk has no `metadata.extraction_step`
- **THEN** no dimension label is shown (only source)
