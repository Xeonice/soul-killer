## ADDED Requirements

### Requirement: Story Setup Agent 独立循环

runStorySetup SHALL 运行一个独立的 ToolLoopAgent 循环，只包含 story-level 的 3 个工具调用。

#### Scenario: 正常完成

- **WHEN** runStorySetup 被调用
- **THEN** SHALL 创建独立的 ToolLoopAgent 实例
- **AND** 工具集 SHALL 仅包含 `set_story_metadata` + `set_story_state` + `set_prose_style` + `ask_user`
- **AND** step cap SHALL 为固定 8（3 正常 + 5 缓冲）
- **AND** stopWhen SHALL 在 `set_prose_style` 成功调用后触发

### Requirement: Story Setup 精简 prompt

runStorySetup 的 initial prompt SHALL 只包含 plan JSON + story-level 所需数据，不包含角色的 identity/milestones/behaviors。

#### Scenario: prompt 内容

- **WHEN** 构造 Story Setup 的 initial prompt
- **THEN** SHALL 包含 plan JSON（genre_direction / tone_direction / shared_axes / flags / prose_direction）
- **AND** SHALL 包含 world manifest + world entries
- **AND** SHALL 包含所有角色的 style.md（prose_style 需要判断非中文占比）
- **AND** SHALL 不包含角色的 identity.md / milestones.md / behaviors/*.md

### Requirement: Story Setup 独立错误处理

#### Scenario: 失败不进入 Character Loop

- **WHEN** Story Setup Agent 失败（step cap 耗尽或 watchdog 超时）
- **THEN** SHALL 发送 error 事件
- **AND** SHALL 不启动 Character Loop

#### Scenario: 熔断器

- **WHEN** 同一个工具连续失败 3 次
- **THEN** SHALL abort 并报错
