## MODIFIED Requirements

### Requirement: planSearch tool
Agent SHALL 提供 `planSearch` tool，LLM 在侦察阶段完成后调用。tool 的 execute 函数 SHALL 根据输入的分类和目标名称，确定性地（不用 LLM）按维度×信息源映射表生成搜索计划。每个维度 SHALL 生成 3-5 条聚焦子话题的 query，每条 query 指向一个具体概念而非并列多个概念。

#### Scenario: 生成虚构角色搜索计划
- **WHEN** LLM 调用 planSearch，传入侦察阶段的搜索结果摘要
- **THEN** execute 函数从结果中提取分类信息
- **AND** 返回 8 个维度的搜索计划，每个维度包含 3-5 条推荐查询
- **AND** 每条查询 SHALL 只包含一个具体子话题（不并列多个概念）

#### Scenario: 搜索计划包含多语言查询
- **WHEN** 目标有中文名和英文名
- **THEN** 计划中的每个维度 SHALL 包含中文和英文两种查询
- **AND** 中文查询和英文查询分别聚焦不同的子话题角度

#### Scenario: 搜索模板不堆砌关键词
- **WHEN** 生成搜索计划的模板 query
- **THEN** 每条模板 query（不含 `{name}` / `{localName}` 占位符）SHALL 包含不超过 3 个有效关键词
- **AND** SHALL 不在单条 query 中并列多个同类实体名称

#### Scenario: planSearch 的 inputSchema
- **WHEN** 定义 planSearch tool
- **THEN** inputSchema SHALL 包含 summary 字段（侦察阶段的总结）
- **AND** execute 函数 SHALL 从 summary 中解析出分类、英文名、中文名、来源

### Requirement: 搜索计划格式
planSearch 返回的计划 SHALL 包含：classification、englishName、dimensions 数组。每个 dimension 项 SHALL 包含 dimension 名称、priority、推荐 queries 数组。

#### Scenario: 计划结构完整
- **WHEN** planSearch 返回结果
- **THEN** dimensions 数组 SHALL 覆盖所有维度（soul 8 个，world 9 个）
- **AND** 每项 SHALL 有 dimension、priority、queries 字段
- **AND** queries 总数 SHALL 在 24-40 条之间（每维度 3-5 条）
