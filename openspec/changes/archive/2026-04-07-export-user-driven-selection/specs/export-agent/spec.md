## MODIFIED Requirements

### Requirement: Export agent 职责收紧为创意工作
export-agent SHALL 只负责创意工作（角色关系分析、好感轴设计、基调推导、打包），不再处理选择或数据读取。

#### Scenario: runExportAgent 签名包含 preSelected 数据
- **WHEN** 调用 `runExportAgent`
- **THEN** 签名 SHALL 为 `runExportAgent(config, preSelected, onProgress, askUser)`
- **AND** `preSelected` SHALL 包含 `souls: string[]`, `worldName: string`, `soulsData: SoulFullData[]`, `worldData: WorldFullData`
- **AND** agent 不再自己扫描或读取任何数据

#### Scenario: 删除扫描工具
- **WHEN** 构造 agent 的 tools 对象
- **THEN** SHALL **不再包含** `list_souls`, `list_worlds`, `read_soul`, `read_world`
- **AND** SHALL 只包含 `package_skill` 和 `ask_user`

#### Scenario: Initial prompt 携带完整数据
- **WHEN** 启动 agent stream
- **THEN** initial user message SHALL 包含完整的 world 数据（manifest + entries）
- **AND** SHALL 包含每个 soul 的 identity / style / capabilities / milestones / behaviors 完整内容
- **AND** agent 无需 tool call 即可访问全部上下文

#### Scenario: System prompt 聚焦创意
- **WHEN** 生成 agent system prompt
- **THEN** SHALL 只描述创意任务（关系分析、好感轴设计、基调推导、调用 package_skill）
- **AND** SHALL 不包含任何"自动选择"、"扫描"、"筛选"相关指引
- **AND** SHALL 明确告知 agent 不要调用 list/read 工具

### Requirement: Agent 正常路径零用户交互
- Agent SHALL 在正常路径下直接分析并调用 package_skill，不通过 ask_user 询问用户

#### Scenario: 数据充足的常规流程
- **WHEN** 收到预选数据且 soulsData/worldData 完整
- **THEN** agent SHALL 直接分析并调用 package_skill
- **AND** 总步数 SHALL 控制在 2-3 步内（思考 → package_skill → 结束）

#### Scenario: 数据严重不足的 fallback
- **WHEN** 分析中发现某些关键数据缺失（如所有 soul 都没有 identity）
- **THEN** SHALL 通过 ask_user 告知用户并建议下一步
- **AND** 不要静默停止

### Requirement: 终止条件保留
- Agent SHALL 以 package_skill 调用结束流程，与上一轮 multi-soul-export 保持一致。

#### Scenario: 成功终止
- **WHEN** 成功调用 package_skill
- **THEN** agent SHALL 立即停止（hasToolCall('package_skill') 作为 stopWhen 条件）

#### Scenario: 异常终止兜底
- **WHEN** stream 结束但未调用 package_skill
- **THEN** SHALL 发出 error 事件并在消息中附带 agent log 路径
