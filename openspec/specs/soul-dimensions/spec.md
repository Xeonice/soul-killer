## ADDED Requirements

### Requirement: 维度模型

Soul 维度模型 SHALL 定义 8 个搜索维度：identity、quotes、expression、thoughts、behavior、relations、capabilities、milestones。ALL_DIMENSIONS 数组 SHALL 包含全部 8 个维度。

#### Scenario: ALL_DIMENSIONS 长度

- **WHEN** ALL_DIMENSIONS 被访问
- **THEN** SHALL 包含 8 个元素

#### Scenario: REQUIRED_DIMENSIONS

- **WHEN** REQUIRED_DIMENSIONS 被计算
- **THEN** SHALL 包含 identity、quotes、expression、capabilities（priority 为 required 的维度）

### Requirement: 分类×维度的信息源映射
系统 SHALL 为每种 TargetClassification（DIGITAL_CONSTRUCT、PUBLIC_ENTITY、HISTORICAL_RECORD）维护一张维度→推荐查询模板的映射表。模板中 SHALL 使用 `{name}`、`{localName}`、`{origin}` 占位符。

#### Scenario: DIGITAL_CONSTRUCT 的 quotes 维度查询
- **WHEN** 分类为 DIGITAL_CONSTRUCT，目标英文名 "Artoria Pendragon"，中文名 "阿尔托莉雅"
- **THEN** quotes 维度的推荐查询 SHALL 包含 `"Artoria Pendragon quotes dialogue"` 和 `"阿尔托莉雅 台词 语录 名言"`

#### Scenario: PUBLIC_ENTITY 的 expression 维度查询
- **WHEN** 分类为 PUBLIC_ENTITY，目标名 "Elon Musk"
- **THEN** expression 维度的推荐查询 SHALL 包含 `"Elon Musk communication style"` 和 `"Elon Musk 说话风格 演讲特点"`

#### Scenario: UNKNOWN_ENTITY 无映射
- **WHEN** 分类为 UNKNOWN_ENTITY
- **THEN** 不生成搜索计划，直接返回空计划

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

### Requirement: 维度覆盖度分析
系统 SHALL 提供覆盖度分析函数，输入为 extractions 数组，输出为各维度的命中数和覆盖判定。覆盖判定 SHALL 基于关键词模式匹配，每条 extraction 可命中多个维度。

#### Scenario: 分析覆盖度
- **WHEN** 输入 5 条 extractions，其中 3 条包含身份信息关键词，1 条包含台词引用
- **THEN** 返回 identity.count=3, identity.covered=true, quotes.count=1, quotes.covered=true

#### Scenario: 判定是否可以 report
- **WHEN** 覆盖度为 3/6 维度，且 required 覆盖 2/3
- **THEN** canReport SHALL 为 true

#### Scenario: 必需维度不足
- **WHEN** 覆盖度为 3/6 但 required 仅覆盖 1/3（只有 identity）
- **THEN** canReport SHALL 为 false
- **AND** suggestion 中 SHALL 提示缺少 quotes 和 expression
