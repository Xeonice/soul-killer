## MODIFIED Requirements

### Requirement: History Pass B emits per-event progress

History 维度的 Pass B（逐个展开时间线事件）SHALL 在每个事件完成时 emit progress 事件并写入 agent log，而非仅在 Pass B 整体完成后输出。

#### Scenario: Pass B per-event emit

- **WHEN** Pass B 完成第 5 个事件（共 20 个）
- **THEN** SHALL emit progress 包含 `historySubProgress: { pass: 'B', eventsDone: 5, eventsTotal: 20, currentEvent: '<name>' }`

#### Scenario: Pass B per-event agent log

- **WHEN** Pass B 完成事件 "fourth-grail-war"
- **THEN** agent log SHALL 写入一行 `[EVENT 5/20] history:pass-b:fourth-grail-war → N chars (Nms)`

### Requirement: UI panel renders history sub-progress

`WorldDistillPanel` SHALL 在检测到 `historySubProgress` 时渲染 Pass 子阶段和 per-event 进度。

#### Scenario: Pass B 进行中的 UI 显示

- **WHEN** `historySubProgress.pass === 'B'` 且 `eventsDone === 12, eventsTotal === 20`
- **THEN** UI SHALL 显示 `▸ history — Pass B: 12/20 events` 及最近完成的事件名列表
