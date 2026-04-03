## ADDED Requirements

### Requirement: Arasaka Logo Random Pixel Annihilation

The exit animation SHALL display the full Arasaka ANSI art logo then annihilate it through random pixel dissolution. The annihilation MUST proceed by randomly replacing visible characters with spaces at a rate of ~5% of remaining visible characters per frame. The logo MUST remain displayed for 1 second before annihilation begins. Total annihilation duration MUST be approximately 3 seconds.

#### Scenario: Logo Annihilation Sequence

- **WHEN** Phase 3 of the exit animation begins
- **THEN** the Arasaka ANSI art logo displays in full for 1 second
- **THEN** random visible characters begin replacing with spaces (~5% per frame)
- **THEN** after approximately 2.5 seconds, fewer than 5% of original characters remain
- **THEN** all remaining characters disappear and the screen shows only the final message

### Requirement: Logo Color Decay During Annihilation

During the annihilation phase, the overall color of the remaining logo characters SHALL decay from PRIMARY (#FF3333) through DIM (#CC4444) to DARK (#440011) proportional to the percentage of characters dissolved.

#### Scenario: Color Transitions During Dissolution

- **WHEN** less than 30% of characters have been dissolved
- **THEN** remaining characters display in PRIMARY (#FF3333)
- **WHEN** 30-70% of characters have been dissolved
- **THEN** remaining characters display in DIM (#CC4444)
- **WHEN** more than 70% of characters have been dissolved
- **THEN** remaining characters display in DARK (#440011)

### Requirement: ANSI-Aware Character Replacement

The annihilation algorithm MUST correctly handle ANSI escape sequences within the logo data. Only visible characters (not escape sequences) SHALL be candidates for replacement. Replacing a visible character with a space MUST NOT corrupt surrounding ANSI escape sequences.

#### Scenario: Escape Sequence Preservation

- **WHEN** a visible character adjacent to an ANSI escape sequence is selected for dissolution
- **THEN** the character is replaced with a space
- **THEN** surrounding ANSI escape sequences remain intact and functional
