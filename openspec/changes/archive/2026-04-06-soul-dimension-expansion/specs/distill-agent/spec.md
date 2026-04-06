# Distill Agent

## ADDED Requirements

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

## MODIFIED Requirements

### Requirement: reviewSoul 读取范围

reviewSoul tool 在读取所有 soul 文件进行自检时，SHALL 同时读取 capabilities.md 和 milestones.md（如存在）。

#### Scenario: reviewSoul 包含新文件

- **WHEN** distill agent 调用 reviewSoul
- **AND** capabilities.md 和 milestones.md 存在
- **THEN** 返回结果 SHALL 包含这两个文件的内容
