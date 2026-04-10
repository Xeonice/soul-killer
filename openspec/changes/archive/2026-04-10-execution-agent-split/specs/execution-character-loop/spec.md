## ADDED Requirements

### Requirement: Character Loop 逐角色独立循环

runCharacterLoop SHALL 逐角色运行独立的 ToolLoopAgent 循环，每轮只处理一个角色。

#### Scenario: 正常逐角色执行

- **WHEN** runCharacterLoop 被调用
- **THEN** SHALL 遍历 plan.characters 列表
- **AND** 每个角色 SHALL 创建独立的 ToolLoopAgent 实例
- **AND** 每轮工具集 SHALL 仅包含 `add_character` + `set_character_axes`
- **AND** 每轮 step cap SHALL 为固定 5（2 正常 + 3 缓冲）

### Requirement: 每角色独立 context

每轮 Character Loop 的 initial prompt SHALL 只包含该角色的数据，不包含其他角色。

#### Scenario: 单角色 prompt 内容

- **WHEN** 为角色 X 构造 initial prompt
- **THEN** SHALL 包含 plan 中角色 X 的方向（role / specific_axes_direction / needs_voice_summary / appears_from）
- **AND** SHALL 包含角色 X 的完整 soul data（identity / style / capabilities / milestones / behaviors）
- **AND** SHALL 包含 story_state 的 shared_axes 名称（set_character_axes 需要）
- **AND** SHALL 不包含其他角色的数据

### Requirement: builder 跨轮共享

所有角色轮次 SHALL 共享同一个 ExportBuilder 实例。

#### Scenario: 累积注册

- **WHEN** 角色 A 的循环完成后启动角色 B 的循环
- **THEN** builder 中 SHALL 已包含角色 A 的注册数据
- **AND** 角色 B 的 add_character 调用 SHALL 成功

### Requirement: 单角色失败阻断

#### Scenario: 某角色失败不继续后续

- **WHEN** 角色 X 的循环失败（step cap 耗尽、watchdog 超时、或熔断器触发）
- **THEN** SHALL 发送 error 事件
- **AND** SHALL 不继续后续角色的处理

### Requirement: 每轮独立的 watchdog 和熔断器

#### Scenario: watchdog 独立

- **WHEN** 每个角色循环启动
- **THEN** SHALL 创建独立的 watchdog（90s）
- **AND** SHALL 创建独立的熔断器（连续 3 次同工具错误）

### Requirement: 进度事件

#### Scenario: per-character 进度

- **WHEN** 角色 X 的 add_character 或 set_character_axes 执行
- **THEN** SHALL 通过 onProgress 发送 tool_start / tool_end 事件
- **AND** 事件格式 SHALL 与当前一致（ExportProtocolPanel 无需改动）
