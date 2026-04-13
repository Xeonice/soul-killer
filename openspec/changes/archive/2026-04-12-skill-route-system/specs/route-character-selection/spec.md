## ADDED Requirements

### Requirement: export agent 焦点角色选取交互

export agent SHALL 在所有角色添加完成后，提供焦点角色选取交互。

#### Scenario: agent 推荐并展示预选列表

- **WHEN** 所有 add_character 完成后
- **THEN** agent SHALL 分析角色数据，按路线潜力排序，预选 top 2-3 个，展示预选列表并标注推荐理由

#### Scenario: 用户确认预选

- **WHEN** 用户确认 agent 的预选列表
- **THEN** SHALL 以预选角色作为路线焦点写入 story-spec

#### Scenario: 用户调整列表

- **WHEN** 用户取消某个预选角色或添加新角色
- **THEN** SHALL 以用户调整后的列表为准

#### Scenario: 最多 4 个焦点角色

- **WHEN** 用户尝试选择超过 4 个角色
- **THEN** SHALL 提示最多 4 个并要求减少

### Requirement: story-spec Routes 段落

story-spec.md SHALL 新增 Routes 段落定义路线结构。

#### Scenario: Routes 段落内容

- **WHEN** 焦点角色确认后
- **THEN** story-spec SHALL 包含: route_model, common_scenes, 每条路线的 id / focus_character / name / theme / route_scenes / endings / gate_condition_hint

#### Scenario: 场景预算按路线分配

- **WHEN** 有 N 条路线，总场景预算 T
- **THEN** 共通线 4 + gate 1 + 每条路线 floor((T-5)/N) 场景
