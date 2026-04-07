# Search Result Confirm

### Requirement: Search result confirmation step

After Agent search completes successfully, the system SHALL display a result summary and prompt the user for confirmation before proceeding.

#### Scenario: Successful search with results
- **WHEN** Agent search completes with classification other than UNKNOWN_ENTITY and qualified articles > 0
- **THEN** the system SHALL display: target name, classification label, origin, total qualified article count
- **AND** SHALL display per-dimension quality breakdown（维度名 + 合格文章数/最低要求 + 条形图）
- **THEN** the system SHALL present options with "确认，继续" selected by default

#### Scenario: Dimension quality breakdown display
- **WHEN** `dimBreakdown` 数据可用
- **THEN** SHALL 按维度展示合格文章数、最低要求数、是否充足
- **AND** 充足维度 SHALL 用主色，不充足维度 SHALL 用警告色
- **AND** 每个维度 SHALL 显示其优先级标签（必需/重要/补充）

#### Scenario: User confirms result
- **WHEN** the user selects "确认，继续" (or presses Enter on default)
- **THEN** the system SHALL proceed to data-sources step

#### Scenario: User rejects result
- **WHEN** the user selects "不对，重新搜索"
- **THEN** the system SHALL return to the name input step
- **THEN** previous search results SHALL be discarded

### Requirement: Default selection minimizes friction

The confirmation prompt SHALL default-select the first option ("确认，继续") so that pressing Enter immediately proceeds.

#### Scenario: Quick confirmation

- **WHEN** the search result confirmation is displayed
- **THEN** the cursor SHALL be on "确认，继续" by default
- **THEN** pressing Enter without any navigation SHALL confirm and proceed
