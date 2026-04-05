## ADDED Requirements

### Requirement: 灵魂信息维度模型
系统 SHALL 定义 6 个灵魂信息维度：identity（身份背景）、quotes（语料台词）、expression（表达风格）、thoughts（思想观点）、behavior（行为模式）、relations（人际关系）。每个维度 SHALL 有优先级分类：required（必需）、important（重要）、supplementary（补充）。

#### Scenario: 维度定义完整性
- **WHEN** 系统加载维度模型
- **THEN** 模型 SHALL 包含 6 个维度，每个带有 priority、description、distillTarget 属性

#### Scenario: 必需维度标识
- **WHEN** 检查维度优先级
- **THEN** identity、quotes、expression 为 required
- **AND** thoughts、behavior 为 important
- **AND** relations 为 supplementary

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
