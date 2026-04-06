# Cloud Skill Format

## MODIFIED Requirements

### Requirement: SKILL.md 视觉小说引擎模板

SKILL.md Phase 1 SHALL 新增读取 capabilities.md 和 milestones.md 的指令。Phase 2 SHALL 新增引用规则。

#### Scenario: Phase 1 读取新文件

- **WHEN** Skill 运行 Phase 1
- **THEN** SHALL 读取 `${CLAUDE_SKILL_DIR}/soul/capabilities.md`（如存在）
- **AND** 读取 `${CLAUDE_SKILL_DIR}/soul/milestones.md`（如存在）
- **AND** 将能力信息和时间线纳入剧本生成的参考材料

#### Scenario: Phase 2 能力引用规则

- **WHEN** 用户在故事中问及角色的能力、技能或装备
- **THEN** Claude SHALL 参考 capabilities.md 中的描述回答
- **AND** 角色行为不超出 capabilities.md 描述的能力范围

#### Scenario: Phase 2 时间线引用规则

- **WHEN** 用户在故事中问及角色的经历或过去事件
- **THEN** Claude SHALL 参考 milestones.md 中的记录回答
- **AND** 角色只知道 milestones.md 中记录的事件，不知道之后发生的事
