## ADDED Requirements

### Requirement: Search result confirmation step

After Agent search completes successfully, the system SHALL display a result summary and prompt the user for confirmation before proceeding.

#### Scenario: Successful search with results

- **WHEN** Agent search completes with classification other than UNKNOWN_ENTITY and chunks > 0
- **THEN** the system SHALL display: target name, classification label, origin, fragment count
- **THEN** the system SHALL present options with "确认，继续" selected by default

#### Scenario: User confirms result

- **WHEN** the user selects "确认，继续" (or presses Enter on default)
- **THEN** the system SHALL proceed to data-sources step

#### Scenario: User rejects result

- **WHEN** the user selects "不对，重新搜索"
- **THEN** the system SHALL return to the name input step
- **THEN** previous search results SHALL be discarded

#### Scenario: User wants to supplement

- **WHEN** the user selects "补充数据源"
- **THEN** the system SHALL proceed directly to data-sources step with search results preserved

### Requirement: Default selection minimizes friction

The confirmation prompt SHALL default-select the first option ("确认，继续") so that pressing Enter immediately proceeds.

#### Scenario: Quick confirmation

- **WHEN** the search result confirmation is displayed
- **THEN** the cursor SHALL be on "确认，继续" by default
- **THEN** pressing Enter without any navigation SHALL confirm and proceed
