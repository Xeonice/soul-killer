## ADDED Requirements

### Requirement: 幕数运行时选择
SKILL.md 引擎 SHALL 在 Phase 0 让用户从 story-spec 提供的 acts_options 中选择故事长度，而非使用 export 时硬编码的固定幕数。

#### Scenario: Phase 0 展示幕数选项
- **WHEN** 用户启动 skill
- **THEN** Phase 0 SHALL 显示故事介绍（genre + tone）
- **AND** SHALL 列出 acts_options 中的所有选项（短篇/中篇/长篇 等）
- **AND** SHALL 标注 default_acts 对应的选项为"推荐"
- **AND** 每个选项 SHALL 显示该长度的 acts、rounds_total、endings_count 摘要

#### Scenario: 用户选择幕数
- **WHEN** 用户从 acts_options 选择一个选项
- **THEN** 引擎 SHALL 记录: `state.chosen_acts`, `state.rounds_budget`, `state.endings_count`
- **AND** 后续所有幕的推进 SHALL 受 chosen_acts 总数约束
- **AND** 后续 rounds 消耗 SHALL 以 rounds_budget 为上限

#### Scenario: 默认值快速通过
- **WHEN** 用户在选项菜单按 Enter 不切换
- **THEN** SHALL 直接采用 default_acts 对应的选项

### Requirement: appears_from 的可变 acts 适配
角色的 `appears_from` 字段在用户选择幕数后 SHALL 按以下规则解析：

#### Scenario: 出场幕在总幕数范围内
- **WHEN** 角色 appears_from = `act_3` 且用户选了 5 幕中篇
- **THEN** 该角色 SHALL 在第 3 幕首次出场

#### Scenario: 出场幕超出总幕数
- **WHEN** 角色 appears_from = `act_5` 且用户选了 3 幕短篇
- **THEN** 引擎 SHALL 截断到最后一幕（第 3 幕）首次出场
- **AND** SHALL 不报错，自然引入

## MODIFIED Requirements

### Requirement: story-spec 多角色扩展
story-spec.md SHALL 支持多角色编排定义和运行时可选幕数。

#### Scenario: characters 数组
- **WHEN** 生成 story-spec.md
- **THEN** YAML front matter SHALL 包含 `characters` 数组
- **AND** 每个 character SHALL 有 name、role、axes（含 name/english/initial）、appears_from

#### Scenario: 幕数选项
- **WHEN** 生成 story-spec.md
- **THEN** YAML front matter SHALL 包含 `acts_options` 数组
- **AND** 每个 ActOption SHALL 包含 `acts`, `label_zh`, `rounds_total`, `endings_count`
- **AND** SHALL 包含 `default_acts` 字段，值必须等于 acts_options 中某项的 acts
- **AND** SHALL 不再包含旧的单值 `acts`, `rounds`, `endings_min` 字段

#### Scenario: 选项 tradeoff 约束
- **WHEN** story-spec 定义选项规则
- **THEN** SHALL 约束每个选项必须对不同角色产生差异化好感影响
- **AND** SHALL 禁止所有选项对所有角色产生相同方向的影响

### Requirement: 角色数量限制
单次导出 SHALL 限制最多 4 个角色。

#### Scenario: 选中的 soul 超过 4 个
- **WHEN** 用户选中的 soul 数量超过 4 个
- **THEN** 上层应提示限制，只保留前 4 个有效 soul（具体筛选规则由上层流程决定）

#### Scenario: 角色数与 acts_options 推荐
- **WHEN** export agent 在 set_story_metadata 时设定 acts_options
- **AND** 角色数 ≤ 2
- **THEN** SHALL 推荐 acts_options [3, 5]，default_acts = 3
- **WHEN** 角色数 3-4
- **THEN** SHALL 推荐 acts_options [3, 5, 7]，default_acts = 5
