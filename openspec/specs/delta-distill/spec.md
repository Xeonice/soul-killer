# Delta Distill

### Requirement: Delta extraction processes only new chunks
The system SHALL provide a delta extraction mode that runs the LLM feature extraction pipeline only on newly ingested chunks, producing delta features rather than a full soul profile.

#### Scenario: Delta extraction from new chunks
- **WHEN** evolve ingests N new chunks into a soul that already has existing chunks
- **THEN** the system SHALL run `extractFeatures()` only on the N new chunks
- **AND** the output is a set of delta features (identity delta, style delta, behavior deltas)

#### Scenario: New chunks below minimum threshold
- **WHEN** evolve ingests fewer than 5 new chunks
- **THEN** the system SHALL warn the user that data is sparse
- **AND** suggest adding more data or using full re-distill mode (`--full`)
- **AND** still proceed with delta extraction if user confirms

### Requirement: LLM-assisted merge combines delta with existing soul files
The system SHALL merge delta features with existing soul file contents using LLM-assisted semantic merge.

#### Scenario: Identity merge with non-conflicting additions
- **WHEN** delta identity contains new information not present in existing `identity.md`
- **THEN** the LLM merge SHALL integrate the new information into the appropriate sections of `identity.md`
- **AND** preserve all existing content that is not contradicted

#### Scenario: Identity merge with conflicting information
- **WHEN** delta identity contradicts existing content in `identity.md`
- **THEN** the LLM merge SHALL prefer the newer information
- **AND** note the evolution in context (e.g., "早期认为X，后来转向Y")

#### Scenario: Style merge preserves voice consistency
- **WHEN** delta style contains new speech patterns
- **THEN** the LLM merge SHALL integrate new patterns into `style.md`
- **AND** maintain the overall coherence of the style description
- **AND** not create contradictory style directives

#### Scenario: Behavior merge adds new behaviors
- **WHEN** delta behaviors contain a new behavior category not in existing `behaviors/`
- **THEN** the system SHALL create a new behavior file for that category
- **AND** existing behavior files remain unchanged

#### Scenario: Behavior merge enriches existing behavior
- **WHEN** delta behaviors contain patterns matching an existing behavior file
- **THEN** the LLM merge SHALL enrich the existing behavior file with new examples and patterns
- **AND** preserve the existing behavior's structure and core patterns

### Requirement: Full re-distill mode remains available
The system SHALL support a `--full` flag or menu option that triggers traditional full re-distill from all chunks.

#### Scenario: User selects full re-distill
- **WHEN** user chooses "全量重蒸馏" in the evolve dimension selection
- **THEN** the system SHALL run the existing full distillation pipeline on all chunks (old + new)
- **AND** this replaces all soul files entirely (after snapshot)

### Requirement: Merge prompt includes dimensional context
The merge LLM prompt SHALL include the target soul's name, tags, and the specific dimension being merged.

#### Scenario: Merge prompt for identity dimension
- **WHEN** merging identity for soul "强尼银手"
- **THEN** the merge prompt SHALL include: the soul name, current identity.md content, delta identity text, and instruction to integrate new identity information while preserving existing characterization

#### Scenario: Merge prompt for style dimension
- **WHEN** merging style for a soul with tags including "冷幽默"
- **THEN** the merge prompt SHALL reference the tag as style guidance
- **AND** instruct to maintain consistency with the tagged style traits
