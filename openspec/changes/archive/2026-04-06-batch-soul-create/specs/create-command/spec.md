## MODIFIED Requirements

### Requirement: Data source selection is unified entry point after confirm
The create command SHALL present a unified data source selection screen after confirm (single mode) or after soul-list confirmation (batch mode). In batch mode, data source selection applies to all souls uniformly.

#### Scenario: Public soul data source selection (single mode)
- **WHEN** a single public soul creation reaches the data-sources step
- **THEN** the screen shows three checkboxes: web search (checked by default), Markdown (unchecked), Twitter Archive (unchecked)

#### Scenario: Personal soul data source selection (single mode)
- **WHEN** a single personal soul creation reaches the data-sources step
- **THEN** the screen shows two checkboxes: Markdown (unchecked), Twitter Archive (unchecked), with no web search option

#### Scenario: Batch mode data source selection
- **WHEN** multiple souls are confirmed in soul-list and proceed to data-sources
- **THEN** the same data source selection screen is shown, and the selection applies to all souls in the batch

#### Scenario: Empty selection skips to distill
- **WHEN** the user submits data-sources with no options selected
- **THEN** the flow proceeds directly to distilling using only synthetic chunks (for each soul in batch mode)

## ADDED Requirements

### Requirement: Soul-list step for managing multiple souls
After the user enters the first soul's name and description, the create command SHALL display a `soul-list` step showing all added souls with options to add another, continue, or remove the last one.

#### Scenario: First soul added
- **WHEN** the user completes name + description for the first soul
- **THEN** the soul-list shows 1 entry and options: [+] 添加另一个 Soul, [→] 继续

#### Scenario: Add another soul
- **WHEN** the user selects [+] in soul-list
- **THEN** the wizard returns to the name input step, and upon completion returns to soul-list with the new soul appended

#### Scenario: Remove last soul
- **WHEN** the user selects [✕] 移除最后一个 with 2+ souls in the list
- **THEN** the last soul is removed and soul-list refreshes

#### Scenario: Remove last soul when only one exists
- **WHEN** the user selects [✕] with only 1 soul in the list
- **THEN** the option is not available (hidden or disabled)

#### Scenario: Continue with single soul
- **WHEN** the user selects [→] 继续 with exactly 1 soul in the list
- **THEN** the wizard proceeds through the original single-soul flow (tags → confirm → data-sources → ...)

#### Scenario: Continue with multiple souls
- **WHEN** the user selects [→] 继续 with 2+ souls in the list
- **THEN** the wizard skips tags input and proceeds to data-sources → batch-capturing → batch-summary

### Requirement: Batch mode skips manual tags input
In batch mode (multiple souls), the tags step SHALL be skipped entirely. Tags SHALL be automatically inferred by the distill agent from captured content.

#### Scenario: Two souls proceed to batch
- **WHEN** the user continues from soul-list with 2 souls
- **THEN** the flow goes directly to data-sources without asking for tags for any soul

### Requirement: Batch mode skips search-confirm
In batch mode, the search-confirm step SHALL be skipped. After capture completes for a soul, it SHALL automatically proceed to distill.

#### Scenario: Soul capture completes in batch
- **WHEN** Soul A's capture finishes during batch execution
- **THEN** Soul A's distill begins immediately without user confirmation

### Requirement: Batch capturing step shows BatchProtocolPanel
During batch execution, the create command SHALL render `BatchProtocolPanel` instead of `SoulkillerProtocolPanel`, passing per-soul progress data.

#### Scenario: Batch execution begins
- **WHEN** 3 souls start batch execution
- **THEN** the view shows `BatchProtocolPanel` with 3 soul entries in compact mode

### Requirement: Batch summary step after all souls complete
After all souls in the batch finish (success or failure), the create command SHALL transition to `batch-summary` step showing results and action menu.

#### Scenario: Batch summary with retry option
- **WHEN** 2 souls succeed and 1 fails
- **THEN** the summary shows results and menu with 完成, 重试失败的, 查看详情

#### Scenario: Retry from summary
- **WHEN** the user selects "重试失败的" in batch summary
- **THEN** the failed souls are re-executed through the batch pipeline and the view returns to batch-capturing

#### Scenario: Complete from summary
- **WHEN** the user selects "完成" in batch summary
- **THEN** `onComplete` is called for each successful soul and the command exits
