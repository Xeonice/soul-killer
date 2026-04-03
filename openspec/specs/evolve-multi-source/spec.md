# Evolve Multi-Source

### Requirement: Evolve supports multiple data source types
The `/evolve` command SHALL support four data source types: `markdown`（目录路径）, `url`（网页 URL 列表）, `text`（直接文本输入）, and `feedback`（对话反馈记录）.

#### Scenario: Source type selection menu
- **WHEN** user enters evolve interactive mode
- **THEN** the system SHALL display a source type selection menu with options: Markdown 目录、URL 网页、文本输入、对话反馈
- **AND** the user selects one source type per evolve session

#### Scenario: Markdown source input
- **WHEN** user selects "Markdown 目录" source type
- **THEN** the system SHALL show a path input with filesystem path completion
- **AND** the input path is passed to the existing MarkdownAdapter for ingestion

#### Scenario: URL source input
- **WHEN** user selects "URL 网页" source type
- **THEN** the system SHALL show a text input for URL entry
- **AND** the user can submit one URL at a time, pressing Enter to add more or submitting empty to finish
- **AND** each URL is fetched and extracted into SoulChunks via the URL adapter

#### Scenario: Text source input
- **WHEN** user selects "文本输入" source type
- **THEN** the system SHALL show a multi-line text input area
- **AND** the submitted text is converted into one or more SoulChunks with `source: 'user-input'`

#### Scenario: Feedback source input
- **WHEN** user selects "对话反馈" source type
- **AND** the current soul has conversation feedback records
- **THEN** the system SHALL convert accumulated feedback records into SoulChunks with `source: 'feedback'`
- **AND** proceed to distillation

#### Scenario: No feedback available
- **WHEN** user selects "对话反馈" source type
- **AND** the current soul has no conversation feedback records
- **THEN** the system SHALL display a message indicating no feedback is available
- **AND** return to the source type selection menu

### Requirement: URL adapter extracts web page content to SoulChunks
The system SHALL provide a URL adapter that fetches web pages and converts their main content into SoulChunks.

#### Scenario: Successful URL extraction
- **WHEN** the URL adapter receives a valid URL
- **THEN** the system SHALL fetch the page HTML
- **AND** extract the main content using Readability
- **AND** convert to Markdown via Turndown
- **AND** split into SoulChunks by paragraph boundaries
- **AND** each chunk has `source: 'web'`, `metadata: {url, title}`

#### Scenario: URL fetch failure
- **WHEN** the URL adapter fails to fetch a URL (network error, 403, 404, etc.)
- **THEN** the system SHALL skip that URL with a warning message
- **AND** continue processing remaining URLs
- **AND** report the skipped URLs in the final summary

#### Scenario: URL returns no extractable content
- **WHEN** the URL adapter fetches a page but Readability extracts no meaningful content
- **THEN** the system SHALL skip that URL with a message "无法提取有效内容"
- **AND** continue processing remaining URLs

### Requirement: Text input creates synthetic SoulChunks
The system SHALL convert direct text input into SoulChunks for evolve ingestion.

#### Scenario: Text input chunk creation
- **WHEN** user submits text content in text input mode
- **THEN** the system SHALL create SoulChunks with `source: 'user-input'`, `type: 'knowledge'`, and current timestamp
- **AND** text longer than 2000 characters SHALL be split into multiple chunks at paragraph boundaries

#### Scenario: Empty text input
- **WHEN** user submits empty text in text input mode
- **THEN** the system SHALL display a warning and return to the source type selection
