## MODIFIED Requirements

### Requirement: 搜索工具集
Agent SHALL 拥有以下 tool 供自主调用：search（统一搜索，单一 query 参数）、extractPage（提取页面完整内容）、planSearch（生成搜索计划）、checkCoverage（检查维度覆盖度）、reportFindings（报告结果并终止循环）。搜索后端根据 config.search.provider 自动选择 Exa/Tavily，自动聚合多源结果（包括 Wikipedia）。

#### Scenario: 简化后的搜索调用
- **WHEN** LLM 调用 search tool
- **THEN** 只需传入 query 字符串
- **AND** 搜索后端根据 config.search.provider 自动选择 Exa/Tavily
- **AND** 返回包含多源内容的结果数组

#### Scenario: search tool 使用 Exa
- **WHEN** config.search.provider 为 exa 且 exa_api_key 存在
- **THEN** 调用 Exa searchAndContents API
- **AND** 结果已包含全文，不需要额外提取

#### Scenario: search tool 使用 Tavily
- **WHEN** config.search.provider 为 tavily 且 tavily_api_key 存在
- **THEN** 调用 Tavily API（advanced + include_raw_content）
- **AND** 结果已包含全文

#### Scenario: planSearch 工具调用
- **WHEN** agent 完成初始侦察后
- **THEN** 调用 planSearch tool，传入侦察结果摘要
- **AND** tool 返回维度×查询的搜索计划

#### Scenario: checkCoverage 工具调用
- **WHEN** agent 在采集阶段搜索了若干轮后
- **THEN** 调用 checkCoverage tool，传入已收集的 extractions
- **AND** tool 返回各维度覆盖状态和建议

#### Scenario: extractPage 工具调用
- **WHEN** agent 发现某个 URL 的摘要内容不够详细
- **THEN** agent 调用 extractPage tool，传入 url 字符串
- **AND** tool 返回该页面的完整 markdown 内容

#### Scenario: reportFindings 终止循环
- **WHEN** LLM 调用 reportFindings
- **THEN** 循环停止，extractions 中每条 SHALL 包含 dimension 字段
