## MODIFIED Requirements

### Requirement: 双循环架构

runExportAgent SHALL 拆分为 Planning Agent → Plan 确认 → Story Setup → Character Loop → Finalize 的五阶段流程。

#### Scenario: 正常五阶段流程

- **WHEN** 调用 runExportAgent
- **THEN** SHALL 先运行 Planning Agent 获取 plan
- **AND** Planning Agent 成功后 SHALL 暂停等待用户确认
- **AND** 用户确认后 SHALL 运行 Story Setup Agent（set_story_metadata + set_story_state + set_prose_style）
- **AND** Story Setup 成功后 SHALL 运行 Character Loop（逐角色 add_character + set_character_axes）
- **AND** Character Loop 成功后 SHALL 运行 Finalize（纯代码打包）

#### Scenario: 任一阶段失败时阻断

- **WHEN** Story Setup Agent 失败
- **THEN** SHALL 不启动 Character Loop
- **WHEN** Character Loop 中某角色失败
- **THEN** SHALL 不继续后续角色且不进入 Finalize

### Requirement: Finalize 阶段为纯代码

Finalize 阶段 SHALL 不使用 LLM，直接调用 builder.build() + packageSkill()。

#### Scenario: Finalize 执行

- **WHEN** Character Loop 全部完成
- **THEN** SHALL 调用 builder.build() 校验完整性
- **AND** SHALL 调用 packageSkill() 生成 .skill 文件
- **AND** SHALL 发送 complete 进度事件
- **AND** 不需要 ToolLoopAgent 或任何 LLM 调用
