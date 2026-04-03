## ADDED Requirements

### Requirement: Progress callback in extractFeatures

The `extractFeatures()` function SHALL accept an optional `onProgress?: (progress: DistillProgress) => void` parameter. When provided, it SHALL emit events at the start and completion of each extraction phase.

#### Scenario: Progress events emitted during extraction

- **WHEN** `extractFeatures()` is called with an `onProgress` callback
- **THEN** progress events SHALL be emitted for phases: identity, style, behavior, merge
- **THEN** the `generate` phase events SHALL be emitted by the caller (create.tsx) since file generation is outside extractor

#### Scenario: Batch-level progress for multi-batch extraction

- **WHEN** a phase processes multiple batches
- **THEN** `onProgress` SHALL be called with `status: 'in_progress'` and `batch`/`totalBatches` for each batch
