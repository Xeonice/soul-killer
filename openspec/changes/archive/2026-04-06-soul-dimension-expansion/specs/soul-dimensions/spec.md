# Soul Dimensions

## MODIFIED Requirements

### Requirement: 维度模型

Soul 维度模型 SHALL 定义 8 个搜索维度：identity、quotes、expression、thoughts、behavior、relations、capabilities、milestones。ALL_DIMENSIONS 数组 SHALL 包含全部 8 个维度。

#### Scenario: ALL_DIMENSIONS 长度

- **WHEN** ALL_DIMENSIONS 被访问
- **THEN** SHALL 包含 8 个元素

#### Scenario: REQUIRED_DIMENSIONS

- **WHEN** REQUIRED_DIMENSIONS 被计算
- **THEN** SHALL 包含 identity、quotes、expression、capabilities（priority 为 required 的维度）

### Requirement: Tag 感知搜索计划

generateSearchPlan SHALL 接受可选的 `tags: TagSet` 参数。当 tags 存在且 domain 不为空时，capabilities 和 milestones 维度的搜索模板 SHALL 追加 domain tags 作为搜索关键词。thoughts 和 behavior 维度 SHALL 可选追加。identity / quotes / expression / relations 不受 tags 影响。

#### Scenario: domain tags 扩展 capabilities 搜索

- **WHEN** generateSearchPlan 传入 tags，domain 为 ["骑士", "剑术"]
- **AND** classification 为 DIGITAL_CONSTRUCT
- **THEN** capabilities 维度的查询 SHALL 包含 "骑士" 和 "剑术" 关键词

#### Scenario: domain tags 扩展 milestones 搜索

- **WHEN** generateSearchPlan 传入 tags，domain 为 ["企业家"]
- **AND** classification 为 PUBLIC_ENTITY
- **THEN** milestones 维度的查询 SHALL 包含 "企业家" 相关关键词

#### Scenario: 无 tags 时退回默认模板

- **WHEN** generateSearchPlan 未传入 tags 或 domain 为空
- **THEN** 所有维度 SHALL 使用纯 classification 模板（与之前行为一致）

### Requirement: 覆盖度分析阈值

analyzeCoverage SHALL 使用更新后的阈值：MIN_TOTAL_COVERED = 4，MIN_REQUIRED_COVERED = 2。

#### Scenario: 覆盖度判定

- **WHEN** 8 个维度中有 4 个被覆盖，required 中有 2 个被覆盖
- **THEN** canReport SHALL 为 true
