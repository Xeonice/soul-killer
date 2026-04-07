## ADDED Requirements

### Requirement: 搜索 query 构造约束规则
Capture agent 的 system prompt SHALL 包含搜索策略约束段落，指导 LLM 构造精准、聚焦的搜索 query。

#### Scenario: query 关键词数量限制
- **WHEN** system prompt 中定义搜索规则
- **THEN** SHALL 要求每个 query 最多包含 4 个有效关键词（目标名称不计入限制）
- **AND** SHALL 禁止在单个 query 中并列多个同类实体（如多个人名、多个地名）

#### Scenario: 语义聚焦规则
- **WHEN** system prompt 中定义搜索规则
- **THEN** SHALL 要求每个 query 只指向一个具体子话题
- **AND** SHALL 鼓励将复合话题拆分为多次独立搜索

#### Scenario: Soul 和 World 策略共享约束
- **WHEN** `SOUL_SYSTEM_PROMPT` 和 `WORLD_SYSTEM_PROMPT` 定义搜索规则
- **THEN** 两者 SHALL 包含相同的 query 构造约束段落

### Requirement: Exa 搜索模式按语言切换
`executeExaSearch` SHALL 根据 query 的语言特征选择搜索模式。

#### Scenario: 中文 query 使用 keyword 模式
- **WHEN** query 包含中文字符（CJK Unicode 范围）
- **THEN** Exa API 调用 SHALL 使用 `type: 'keyword'`

#### Scenario: 纯英文 query 保持 auto 模式
- **WHEN** query 不包含 CJK 字符
- **THEN** Exa API 调用 SHALL 使用 `type: 'auto'`
