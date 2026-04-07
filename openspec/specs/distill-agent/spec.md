## ADDED Requirements

### Requirement: Agent-driven distillation with tool loop
The system SHALL provide a `distillSoul` function that uses a `ToolLoopAgent` to autonomously distill raw chunks into soul files (identity.md, style.md, behaviors/*.md, examples/*.md) through tool calling.

#### Scenario: Successful distillation
- **WHEN** `distillSoul` is called with chunks for a target
- **THEN** the agent samples chunks, writes identity.md, style.md, behavior files, example files, reviews for consistency, and calls finalize

#### Scenario: Agent forced to finalize at max steps
- **WHEN** the agent reaches maxSteps - 1 without calling finalize
- **THEN** prepareStep forces toolChoice to finalize

### Requirement: sampleChunks tool
The sampleChunks tool SHALL return a subset of chunks, optionally filtered by dimension, with a configurable limit.

#### Scenario: Filter by dimension
- **WHEN** sampleChunks is called with dimension "quotes"
- **THEN** only chunks with matching extraction_step are returned

#### Scenario: Dimension not found fallback
- **WHEN** sampleChunks is called with a dimension that no chunks match
- **THEN** a general sample of all chunks is returned

### Requirement: writeIdentity tool
The writeIdentity tool SHALL write identity.md with a "# Identity" prefix.

#### Scenario: Write identity
- **WHEN** writeIdentity is called with content
- **THEN** `soulDir/soul/identity.md` is created and character count returned

### Requirement: writeStyle tool
The writeStyle tool SHALL write style.md with a "# Style" prefix. The system prompt SHALL guide the agent to include a raw quotes/expressions section preserving original dialogue.

#### Scenario: Write style with quotes section
- **WHEN** writeStyle is called
- **THEN** the content includes both analytical style description and a section with preserved original quotes/expressions

### Requirement: writeBehavior tool
The writeBehavior tool SHALL write a behavior file with auto-slugified name.

#### Scenario: Write behavior
- **WHEN** writeBehavior is called with name "Honor Code"
- **THEN** `soulDir/soul/behaviors/honor-code.md` is created

### Requirement: writeExample tool
The writeExample tool SHALL write a conversation example file to the examples directory.

#### Scenario: Write greeting example
- **WHEN** writeExample is called with scenario "greeting" and messages [{role:"user", content:"你好"}, {role:"character", content:"吾乃骑士王..."}]
- **THEN** `soulDir/examples/greeting.md` is created with formatted dialogue

#### Scenario: Multiple examples generated
- **WHEN** the agent completes distillation
- **THEN** at least 3 example files are generated covering different conversation types

### Requirement: reviewSoul 读取范围

reviewSoul tool 在读取所有 soul 文件进行自检时，SHALL 同时读取 capabilities.md 和 milestones.md（如存在）。

#### Scenario: reviewSoul 包含新文件

- **WHEN** distill agent 调用 reviewSoul
- **AND** capabilities.md 和 milestones.md 存在
- **THEN** 返回结果 SHALL 包含这两个文件的内容

### Requirement: finalize tool ends distillation
The finalize tool SHALL signal the end of the distillation loop.

#### Scenario: Agent calls finalize
- **WHEN** the agent calls finalize
- **THEN** the tool loop stops and distillSoul returns

### Requirement: System prompt guides style quotes and relationships
The system prompt SHALL instruct the agent to include original quotes in style.md and to create a relationships behavior file when relation data is available.

#### Scenario: Style includes quotes section
- **WHEN** the agent writes style.md
- **THEN** the system prompt has guided it to include a "典型表达" or "Characteristic Expressions" section with direct quotes

#### Scenario: Relationships behavior created
- **WHEN** relation dimension data is available in chunks
- **THEN** the agent is guided to create a relationships.md behavior file

### Requirement: writeCapabilities Tool

distill agent SHALL 提供 `writeCapabilities` tool，将角色能力数据写入 `soul/capabilities.md`。

#### Scenario: 写入 capabilities 文件

- **WHEN** distill agent 调用 `writeCapabilities({ content: "..." })`
- **THEN** SHALL 写入 `{soulDir}/soul/capabilities.md`
- **AND** 文件以 `# Capabilities` 标题开头

### Requirement: writeMilestones Tool

distill agent SHALL 提供 `writeMilestones` tool，将角色时间线数据写入 `soul/milestones.md`。

#### Scenario: 写入 milestones 文件

- **WHEN** distill agent 调用 `writeMilestones({ content: "..." })`
- **THEN** SHALL 写入 `{soulDir}/soul/milestones.md`
- **AND** 文件以 `# Milestones` 标题开头

### Requirement: capabilities.md 输出规范

distill agent system prompt SHALL 定义 capabilities.md 的内容规范：对虚构角色包含能力系统、属性数值、装备、战斗技能；对真实人物包含专业技能、方法论、核心能力。

#### Scenario: 虚构角色 capabilities

- **WHEN** 蒸馏 Saber 的 capabilities
- **THEN** capabilities.md SHALL 包含宝具描述、职阶技能、个人技能、能力参数

#### Scenario: 真实人物 capabilities

- **WHEN** 蒸馏张一鸣的 capabilities
- **THEN** capabilities.md SHALL 包含专业方法论、核心技能、决策框架

### Requirement: milestones.md 输出规范

distill agent system prompt SHALL 定义 milestones.md 的结构化时间线格式：每个事件包含时间标记、事件描述、对角色的影响/状态变化。事件按时间顺序排列。

#### Scenario: 结构化时间线

- **WHEN** 蒸馏阿尔托莉雅的 milestones
- **THEN** milestones.md SHALL 包含按时间顺序排列的事件
- **AND** 每个事件有时间标记（如 "[15岁]"、"[卡美洛末期]"）
- **AND** 每个事件有对角色状态的影响描述

### Requirement: Relationships behavior 必须生成
distill agent 在 capture 有 relations 维度数据时 SHALL 必须生成 `behaviors/relationships.md`。

#### Scenario: capture 有 relations 维度数据
- **WHEN** distill agent 启动且 capture 的维度缓存中存在 relations 维度（`sessionDir/relations.json` 存在且有合格文章）
- **THEN** agent SHALL 必须调用 `writeBehavior("relationships", ...)` 生成 `behaviors/relationships.md`
- **AND** 如果 agent 在 finalize 前仍未写 relationships，`prepareStep` SHALL 强制引导 agent 先写 relationships 再 finalize

#### Scenario: capture 无 relations 维度数据
- **WHEN** distill agent 启动且 capture 的维度缓存中不存在 relations 维度
- **THEN** agent MAY 从 identity/milestones 中提取关系信息写入 relationships.md
- **AND** 不强制要求

#### Scenario: relationships.md 内容结构
- **WHEN** agent 生成 relationships.md
- **THEN** SHALL 按角色对分节（每个相关角色一个二级标题）
- **AND** 每节 SHALL 包含关系类型、互动模式、情感动态
- **AND** 角色名称 SHALL 使用该角色的通用称谓（便于 export agent 交叉匹配）
