## MODIFIED Requirements

### Requirement: 搜索工具集
Agent 的 search tool（source: "web"）SHALL 使用搜索降级链选择后端，而非固定使用 Tavily 或 DuckDuckGo。createAgentTools 函数 SHALL 接受 searxngAvailable 参数来决定是否启用 SearXNG 后端。

#### Scenario: search tool 使用 SearXNG
- **WHEN** SearXNG 可用且 LLM 调用 search(source: "web")
- **THEN** 搜索请求发送到本地 SearXNG 实例
- **AND** 返回聚合的多源搜索结果

#### Scenario: search tool 降级到 Tavily
- **WHEN** SearXNG 不可用且 Tavily key 存在
- **THEN** 搜索请求发送到 Tavily API
