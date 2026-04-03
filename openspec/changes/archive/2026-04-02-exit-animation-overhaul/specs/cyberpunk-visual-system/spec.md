## MODIFIED Requirements

### Requirement: Exit Animation Sequence

The system SHALL render a 4-phase exit animation when the user quits, with a total duration of approximately 12.5 seconds. Phase 1 (System Shutdown, 3s) MUST display a shutdown warning with Japanese elements, neural state compression progress, and heartbeat decay to flatline. Phase 2 (Data Collapse, 4s) MUST display hex data lines with progressively increasing glitch corruption. Phase 3 (Logo Annihilation, 4s) MUST display the Arasaka ANSI art logo then dissolve it through random pixel annihilation with color decay. Phase 4 (Final Message, 1.5s) MUST display "「 flatline. connection terminated 」" in DIM red before exiting.

#### Scenario: User Exits Via /exit

- **WHEN** the user enters the `/exit` command
- **THEN** Phase 1 displays shutdown warning, compression progress, and heartbeat decay for 3s
- **THEN** Phase 2 displays corrupting hex data lines for 4s
- **THEN** Phase 3 displays and annihilates the Arasaka logo for 4s
- **THEN** Phase 4 displays the final message for 1.5s
- **THEN** the process exits

#### Scenario: Exit With Ctrl+C

- **WHEN** the user presses Ctrl+C
- **THEN** the same exit animation plays (no accelerated form)
- **THEN** the process exits
