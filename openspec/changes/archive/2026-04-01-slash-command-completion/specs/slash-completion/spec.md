## ADDED Requirements

### Requirement: Completion triggers on slash input
When the user types `/` as the first character, the system SHALL display a command candidate list immediately.

#### Scenario: User types slash
- **WHEN** user types `/` in an empty input field
- **THEN** a candidate list appears showing all available commands with descriptions

#### Scenario: User types slash after clearing input
- **WHEN** user clears input and types `/`
- **THEN** the candidate list reappears with all commands

### Requirement: Real-time prefix filtering
The candidate list SHALL filter in real-time as the user continues typing after `/`.

#### Scenario: Partial input filters list
- **WHEN** user has typed `/cr`
- **THEN** only commands starting with `cr` are shown (e.g., `/create`)

#### Scenario: No matches hides list
- **WHEN** user has typed `/xyz` with no matching commands
- **THEN** the candidate list is hidden

#### Scenario: Backspace restores candidates
- **WHEN** user types `/cr` then presses backspace to get `/c`
- **THEN** the list updates to show all commands starting with `c`

### Requirement: Keyboard navigation
The candidate list SHALL support keyboard navigation with arrow keys.

#### Scenario: Down arrow moves selection
- **WHEN** the candidate list is open and user presses down arrow
- **THEN** the selection moves to the next item (wrapping at bottom)

#### Scenario: Up arrow moves selection
- **WHEN** the candidate list is open and user presses up arrow
- **THEN** the selection moves to the previous item (wrapping at top)

### Requirement: Tab confirms selection
Pressing Tab SHALL fill the selected command into the input field.

#### Scenario: Tab completes command
- **WHEN** the candidate list is open with `/create` selected and user presses Tab
- **THEN** the input field is filled with `/create ` (with trailing space) and the list closes

### Requirement: Enter confirms and submits
Pressing Enter when the list is open SHALL fill the selected command and submit it.

#### Scenario: Enter completes and submits
- **WHEN** the candidate list is open with `/help` selected and user presses Enter
- **THEN** the input is set to `/help` and the command is submitted

### Requirement: Escape closes list
Pressing Escape SHALL close the candidate list without changing the input.

#### Scenario: Escape dismisses list
- **WHEN** the candidate list is open and user presses Escape
- **THEN** the list closes and the current input text remains unchanged

### Requirement: List closes on non-slash input
The candidate list SHALL close when the input no longer starts with `/`.

#### Scenario: Backspace removes slash
- **WHEN** the input is `/` and user presses backspace (input becomes empty)
- **THEN** the candidate list closes

### Requirement: Visual styling matches Cyberpunk theme
The candidate list SHALL use the project's Cyberpunk color palette.

#### Scenario: List renders with correct colors
- **WHEN** the candidate list is displayed
- **THEN** the border is cyan, the title label is magenta, the selected item is cyan, and unselected items are dim

### Requirement: List has max visible items with scrolling
The candidate list SHALL show at most 8 items, scrolling when there are more.

#### Scenario: Scroll window follows cursor
- **WHEN** there are 15 commands and user presses down arrow past the 8th visible item
- **THEN** the visible window scrolls to keep the selected item in view
