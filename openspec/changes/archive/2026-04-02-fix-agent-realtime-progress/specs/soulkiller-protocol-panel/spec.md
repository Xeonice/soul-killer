## MODIFIED Requirements

### Requirement: Panel shows realtime tool call progress
The Soulkiller Protocol Panel SHALL display each tool call in real-time as the agent executes.

#### Scenario: Search query displayed
- **WHEN** the agent starts a search tool call
- **THEN** the panel shows "searching: {query}" with a spinner

#### Scenario: Search result count displayed
- **WHEN** a search tool call completes
- **THEN** the panel updates to show "found N results" and the spinner changes to ✓

#### Scenario: Multiple tool calls shown sequentially
- **WHEN** the agent makes 4 search calls
- **THEN** each call is shown as a separate line in the extraction section with its query and status
