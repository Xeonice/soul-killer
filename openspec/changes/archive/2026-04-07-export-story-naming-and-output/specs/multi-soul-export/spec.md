## MODIFIED Requirements

### Requirement: story-spec 多角色扩展
story-spec.md SHALL 支持多角色编排定义、运行时可选幕数，以及故事身份字段（story_name 和可选的 user_direction）。

#### Scenario: characters 数组
- **WHEN** 生成 story-spec.md
- **THEN** YAML front matter SHALL 包含 `characters` 数组
- **AND** 每个 character SHALL 有 name、role、axes（含 name/english/initial）、appears_from

#### Scenario: 故事身份字段
- **WHEN** 生成 story-spec.md
- **THEN** YAML front matter SHALL 包含 `story_name` 字段（非空字符串，用户在 wizard 提供）
- **WHEN** 用户在 wizard 提供了 story direction
- **THEN** YAML front matter SHALL 包含 `user_direction` 字段（存储原始文本）
- **WHEN** 用户跳过了 story direction
- **THEN** YAML front matter SHALL 不包含 `user_direction` 字段

#### Scenario: 幕数选项
- **WHEN** 生成 story-spec.md
- **THEN** YAML front matter SHALL 包含 `acts_options` 数组
- **AND** 每个 ActOption SHALL 包含 `acts`, `label_zh`, `rounds_total`, `endings_count`
- **AND** SHALL 包含 `default_acts` 字段
- **AND** SHALL 不再包含旧的单值 `acts`, `rounds`, `endings_min` 字段

#### Scenario: 选项 tradeoff 约束
- **WHEN** story-spec 定义选项规则
- **THEN** SHALL 约束每个选项必须对不同角色产生差异化好感影响
- **AND** SHALL 禁止所有选项对所有角色产生相同方向的影响
