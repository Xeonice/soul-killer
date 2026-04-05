## MODIFIED Requirements

### Requirement: 搜索工具集
Agent 的 search tool SHALL 简化为单一 query 参数输入（移除 source 和 lang 参数）。搜索后端自动聚合多源结果（包括 Wikipedia）。不再提供独立的 Wikipedia source 选项。

#### Scenario: 简化后的搜索调用
- **WHEN** LLM 调用 search tool
- **THEN** 只需传入 query 字符串
- **AND** 搜索后端根据 config.search.provider 自动选择 SearXNG/Exa/Tavily
- **AND** 返回包含多源内容的结果数组

### Requirement: System Prompt
System prompt SHALL 移除 `source: "wikipedia"` 相关指导。搜索指令简化为引导 LLM 直接用 search tool 搜索，搜索引擎自动聚合多源。

#### Scenario: 简化的搜索引导
- **WHEN** agent 开始执行
- **THEN** system prompt 指导 LLM 直接用 search tool 搜索
- **AND** 不再提及 wikipedia source 选���
