## MODIFIED Requirements

### Requirement: set_story_metadata 使用结构化参数

`set_story_metadata` 的 acts_options 参数 SHALL 为结构化对象数组而非 CSV 字符串。

#### Scenario: LLM 传入对象数组

- **WHEN** LLM 调用 set_story_metadata 传入 `acts_options: [{acts: 3, label: "short", rounds_total: "24-36", endings_count: 4}]`
- **THEN** SHALL 直接使用，无需 CSV 解析

### Requirement: set_story_state 使用结构化参数

`set_story_state` 的 flags 参数 SHALL 为结构化对象数组而非 CSV 字符串。

#### Scenario: LLM 传入对象数组

- **WHEN** LLM 调用 set_story_state 传入 `flags: [{name: "met_johnny", desc: "Player first meets Johnny", initial: false}]`
- **THEN** SHALL 直接使用，无需 CSV 解析
