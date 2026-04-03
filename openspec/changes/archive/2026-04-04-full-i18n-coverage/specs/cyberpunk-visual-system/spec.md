## MODIFIED Requirements

### Requirement: Animation text supports multilingual display
Boot and exit animations SHALL display text in the user's configured language while preserving the cyberpunk aesthetic.

#### Scenario: Boot animation in Chinese
- **WHEN** language is `zh`
- **THEN** boot animation panel shows `灵魂杀手终端 · [荒坂工业]`

#### Scenario: Boot animation in Japanese
- **WHEN** language is `ja`
- **THEN** boot animation panel shows `ソウルキラー端末 · [荒坂産業]`

#### Scenario: Boot animation in English
- **WHEN** language is `en`
- **THEN** boot animation panel shows `SOULKILLER TERMINAL · [ARASAKA IND.]`

#### Scenario: Exit animation disconnect message
- **WHEN** the exit animation plays
- **THEN** the disconnect status text SHALL be in the user's configured language
