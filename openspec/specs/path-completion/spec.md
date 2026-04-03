## ADDED Requirements

### Requirement: Path completion triggers on input
When TextInput is in pathCompletion mode, the system SHALL list matching files and directories as the user types a path.

#### Scenario: User types partial directory path
- **WHEN** user types `~/no` in a path-completion TextInput
- **THEN** a list appears showing entries in `~` that start with `no` (e.g., `~/notes/`)

#### Scenario: User types directory with trailing slash
- **WHEN** user types `~/notes/`
- **THEN** a list appears showing all entries inside `~/notes/`

### Requirement: Tilde expansion
The path completion SHALL expand `~` to the user's home directory when querying the file system.

#### Scenario: Tilde at start
- **WHEN** user types `~/Doc`
- **THEN** the system queries `$HOME/` and filters entries starting with `Doc`

### Requirement: Directory and file visual distinction
Directories and files in the completion list SHALL be visually distinguishable.

#### Scenario: Mixed directory and file entries
- **WHEN** completion list shows both directories and files
- **THEN** directories are shown in cyan with `/` suffix, files are shown in dim without suffix

### Requirement: Tab expands directory or confirms file
Tab SHALL expand into a directory (showing its contents) or confirm a file path.

#### Scenario: Tab on a directory
- **WHEN** user selects `~/notes/` and presses Tab
- **THEN** the input is filled with `~/notes/` and the completion list refreshes to show contents of `~/notes/`

#### Scenario: Tab on a file
- **WHEN** user selects `~/notes/README.md` and presses Tab
- **THEN** the input is filled with `~/notes/README.md` and the completion list closes

### Requirement: Enter confirms path
Enter SHALL fill the selected path and submit it.

#### Scenario: Enter on selected path
- **WHEN** user presses Enter with a path selected in completion list
- **THEN** the path is submitted to the onSubmit handler

### Requirement: Max visible items with scrolling
The path completion list SHALL show at most 8 items with scroll support.

#### Scenario: Directory with many entries
- **WHEN** a directory has 20 entries and user opens completion
- **THEN** only 8 are visible, arrow keys scroll through all 20

### Requirement: Graceful handling of permission errors
The path completion SHALL silently handle permission errors without showing error UI.

#### Scenario: Unreadable directory
- **WHEN** user types a path to a directory without read permission
- **THEN** the completion list is empty (no error displayed)
