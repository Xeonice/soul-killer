## ADDED Requirements

### Requirement: Planning prompt 输出路线候选角色

Planning 阶段 SHALL 分析角色的路线潜力，在 plan JSON 中输出 route_candidates。

#### Scenario: 多角色世界有路线候选

- **WHEN** planning 分析含 3+ 角色的世界
- **THEN** plan JSON SHALL 包含 `route_candidates: [{slug, name, reason}]`（2-3 个推荐）

#### Scenario: 单角色或数据不足

- **WHEN** 只有 1 个角色或角色数据不足以支撑路线
- **THEN** plan JSON 的 route_candidates SHALL 为空数组

### Requirement: Route Selection 交互步骤

在 Character Loop 完成后、Finalize 之前，SHALL 执行路线角色选取交互。

#### Scenario: 有候选时展示预选列表

- **WHEN** plan.route_candidates 非空
- **THEN** SHALL 通过 askUser 展示预选列表和推荐理由，等待用户确认/调整

#### Scenario: 用户确认预选

- **WHEN** 用户确认预选列表
- **THEN** SHALL 调用 builder.setRouteCharacters 写入

#### Scenario: 用户调整列表

- **WHEN** 用户修改预选（增减角色）
- **THEN** SHALL 以用户调整后的列表为准

#### Scenario: 无候选时跳过

- **WHEN** plan.route_candidates 为空或只有 1 个角色
- **THEN** SHALL 跳过路线选取，不调用 setRouteCharacters

### Requirement: SKILL.md 路线指引强制化

当 story-spec 有 Routes 段落时，SKILL.md Phase 1 路线指引 SHALL 从条件性（"if"）改为强制性（"MUST"）。

#### Scenario: 有路线的 skill

- **WHEN** route_characters 非空
- **THEN** SKILL.md SHALL 包含 "You MUST create an affinity_gate scene" + "You MUST create route-specific scenes for each route"

#### Scenario: 无路线的 skill

- **WHEN** route_characters 为空
- **THEN** SKILL.md SHALL 保持现有的条件性指引（向后兼容）

## MODIFIED Requirements

### Requirement: plan_story 工具包含路线候选

plan_story 工具 SHALL 新增 route_candidates 参数。

#### Scenario: plan_story 输出包含候选

- **WHEN** agent 调用 plan_story
- **THEN** SHALL 传入 route_candidates 数组
