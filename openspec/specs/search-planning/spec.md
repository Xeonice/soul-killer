## ADDED Requirements

### Requirement: planSearch tool
Agent SHALL 提供 `planSearch` tool，LLM 在侦察阶段完成后调用。tool 的 execute 函数 SHALL 根据输入的分类和目标名称，确定性地（不用 LLM）按维度×信息源映射表生成搜索计划。

#### Scenario: 生成虚构角色搜索计划
- **WHEN** LLM 调用 planSearch，传入侦察阶段的搜索结果摘要
- **THEN** execute 函数从结果中提取分类信息
- **AND** 返回 6 个维度的搜索计划，每个维度包含 2-3 条推荐查询

#### Scenario: 搜索计划包含多语言查询
- **WHEN** 目标有中文名和英文名
- **THEN** 计划中的每个维度 SHALL 包含中文和英文两种查询

#### Scenario: planSearch 的 inputSchema
- **WHEN** 定义 planSearch tool
- **THEN** inputSchema SHALL 包含 summary 字段（侦察阶段的总结）
- **AND** execute 函数 SHALL 从 summary 中解析出分类、英文名、中文名、来源

### Requirement: 搜索计划格式
planSearch 返回的计划 SHALL 包含：classification、englishName、dimensions 数组。每个 dimension 项 SHALL 包含 dimension 名称、priority、推荐 queries 数组（每个 query 含 source 和 query 字符串）。

#### Scenario: 计划结构完整
- **WHEN** planSearch 返回结果
- **THEN** dimensions 数组 SHALL 有 6 项（对应 6 个维度）
- **AND** 每项 SHALL 有 dimension、priority、queries 字段
- **AND** queries 中每项 SHALL 有 source（"web"|"wikipedia"）和 query 字符串
