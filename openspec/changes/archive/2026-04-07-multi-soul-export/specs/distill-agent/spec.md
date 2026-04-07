## MODIFIED Requirements

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
