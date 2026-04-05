## ADDED Requirements

### Requirement: Log cleanup menu entry
The `/config` command SHALL include a "Clean Agent Logs" option in the settings menu.

#### Scenario: Menu item visible
- **WHEN** user runs `/config`
- **THEN** "Clean Agent Logs" appears as a selectable menu item

### Requirement: Log space statistics display
When the user selects "Clean Agent Logs", the system SHALL display the log directory path, file count, and total disk usage before prompting for confirmation.

#### Scenario: Logs exist
- **WHEN** user selects "Clean Agent Logs" and `~/.soulkiller/logs/agent/` contains 23 files totaling 4.7 MB
- **THEN** the system displays: directory path, "Files: 23", "Size: 4.7 MB"

#### Scenario: No logs exist
- **WHEN** user selects "Clean Agent Logs" and the log directory is empty or does not exist
- **THEN** the system displays "No agent logs found" and returns to the config menu without prompting for deletion

### Requirement: Deletion confirmation
The system SHALL require explicit user confirmation before deleting log files. Deletion SHALL only proceed on affirmative input.

#### Scenario: User confirms deletion
- **WHEN** the system shows log statistics and the user confirms with "Y"
- **THEN** all files in `~/.soulkiller/logs/agent/` are deleted and the system displays a success message with the count and size freed

#### Scenario: User cancels deletion
- **WHEN** the system shows log statistics and the user presses "N" or any other key
- **THEN** no files are deleted and the user returns to the config menu
