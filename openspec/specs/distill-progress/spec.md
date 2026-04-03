# Distill Progress

### Requirement: Distillation progress events

The `extractFeatures()` function SHALL accept an optional `onProgress` callback that receives phase-level progress events during distillation.

#### Scenario: Full distillation with progress

- **WHEN** `extractFeatures()` is called with an `onProgress` callback
- **THEN** the callback SHALL be invoked at the start and completion of each phase: identity extraction, style extraction, behavior extraction, merge, and file generation
- **THEN** for multi-batch phases, the callback SHALL include batch progress (current/total)

#### Scenario: No progress callback

- **WHEN** `extractFeatures()` is called without `onProgress`
- **THEN** behavior SHALL be identical to current implementation (no events emitted)

### Requirement: Distillation progress UI

The create command SHALL display a phase-level progress indicator during distillation.

#### Scenario: Multi-batch extraction display

- **WHEN** identity extraction is running on batch 2 of 3
- **THEN** the UI SHALL show: `▸ 提取身份特征 (2/3) ⠹`

#### Scenario: Phase completion display

- **WHEN** identity extraction completes
- **THEN** the UI SHALL show: `▸ 提取身份特征 ✓`
- **THEN** the next phase SHALL show as active

#### Scenario: Pending phases display

- **WHEN** style extraction is active
- **THEN** subsequent phases (behavior, merge, generate) SHALL show as `○` (pending)

### Requirement: Progress event types

The progress system SHALL define the following phases: `identity`, `style`, `behavior`, `merge`, `generate`. Each event SHALL include phase name, status (`started` | `in_progress` | `done`), and optional batch info.

#### Scenario: Event sequence for single-batch distillation

- **WHEN** distillation runs with ≤ 30 chunks (single batch)
- **THEN** events SHALL fire in order: identity started → identity done → style started → style done → behavior started → behavior done → merge started → merge done → generate started → generate done

#### Scenario: Event sequence for multi-batch distillation

- **WHEN** distillation runs with > 30 chunks (multiple batches)
- **THEN** identity phase SHALL emit: started → in_progress(1/N) → in_progress(2/N) → ... → done
