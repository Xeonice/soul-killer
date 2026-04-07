## ADDED Requirements

### Requirement: Compact view displays all souls as single-line entries
The batch progress view SHALL display each soul as a single line containing: name, current phase, progress indicator, and fragment count.

#### Scenario: Three souls in progress
- **WHEN** batch capture is running with 3 souls at different phases
- **THEN** the view shows 3 lines, each with soul name, phase label (capturing/distilling/done/failed), a progress bar, and fragment count

#### Scenario: Soul transitions to distilling
- **WHEN** Soul A's capture completes and distill begins
- **THEN** Soul A's line updates phase to "distilling" and progress bar resets

### Requirement: Compact view supports cursor navigation
The compact view SHALL highlight the currently selected soul. Up/down arrow keys SHALL move the selection cursor.

#### Scenario: User presses down arrow
- **WHEN** the cursor is on Soul A and user presses down arrow
- **THEN** the cursor moves to Soul B

#### Scenario: Cursor wraps at boundaries
- **WHEN** the cursor is on the last soul and user presses down arrow
- **THEN** the cursor stays on the last soul (no wrap)

### Requirement: Enter expands to detailed view
Pressing Enter on a selected soul SHALL switch to detailed view, showing that soul's full progress panel (reusing `SoulkillerProtocolPanel` for capture phase or `DistillProgressPanel` for distill phase).

#### Scenario: Expand soul during capture
- **WHEN** user presses Enter on Soul A which is in capturing phase
- **THEN** the view switches to show `SoulkillerProtocolPanel` with Soul A's tool calls, classification, and search plan

#### Scenario: Expand soul during distill
- **WHEN** user presses Enter on Soul A which is in distilling phase
- **THEN** the view switches to show `DistillProgressPanel` with Soul A's distill tool calls

### Requirement: Esc returns from detailed to compact view
Pressing Esc in detailed view SHALL return to the compact list view, preserving the cursor position.

#### Scenario: Return to compact view
- **WHEN** user presses Esc in the detailed view of Soul A
- **THEN** the view switches back to compact list with cursor still on Soul A

### Requirement: Compact view shows overall progress summary
The compact view SHALL display an overall summary line showing: active count, completed count, failed count, and total elapsed time.

#### Scenario: Mixed progress summary
- **WHEN** 1 soul is done, 1 is capturing, 1 is distilling
- **THEN** the summary shows "1/3 complete · 2 active · 0 failed"

### Requirement: Batch summary view after completion
When all souls finish, the view SHALL transition to a summary showing per-soul results with success/failure status, and a menu with options: "完成", "重试失败的" (if any failed), "查看详情".

#### Scenario: All succeed
- **WHEN** all 3 souls complete successfully
- **THEN** summary shows 3 success entries and menu with "完成" and "查看详情"

#### Scenario: Some failed
- **WHEN** 2 succeed and 1 fails
- **THEN** summary shows 2 success + 1 failure entries and menu with "完成", "重试失败的", "查看详情"

### Requirement: Progress update throttling
The compact view SHALL throttle progress updates to prevent render flickering. Non-selected souls' detail data SHALL NOT trigger re-renders in compact mode.

#### Scenario: Rapid progress events
- **WHEN** 3 agents emit progress events within 50ms of each other
- **THEN** the compact view batches updates and renders once
