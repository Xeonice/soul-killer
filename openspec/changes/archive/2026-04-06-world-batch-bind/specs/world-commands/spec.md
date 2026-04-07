## ADDED Requirements

### Requirement: World action menu bind/unbind entries
The world action menu SHALL replace the separate "bind" and "unbind" entries with a single "绑定管理" entry that does not require a loaded soul.

#### Scenario: Action menu shows bind management
- **WHEN** the action menu is displayed for a selected world
- **THEN** a single "绑定管理" action is shown (not separate bind/unbind), and it is always enabled regardless of whether a soul is loaded

#### Scenario: Bind management launches checkbox UI
- **WHEN** the user selects "绑定管理" from the action menu
- **THEN** the WorldBindCommand is rendered with only the worldName prop (no soulDir or action)
