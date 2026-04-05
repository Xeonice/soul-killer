## MODIFIED Requirements

### Requirement: 搜索后端降级链
search tool SHALL 根据 config.search.provider 选择后端：SearXNG（本地 Docker + page extraction）、Exa（API + 自带全文）、Tavily（API + 短结果补提取）。不再 fallback 到 DuckDuckGo。无后端可用时返回空结果。

#### Scenario: SearXNG 后端
- **WHEN** provider 为 searxng 且容器可用
- **THEN** 调用 SearXNG JSON API 搜索
- **AND** 对短结果自动提取全文

#### Scenario: Exa 后端
- **WHEN** provider 为 exa 且 exa_api_key 存在
- **THEN** 调用 Exa searchAndContents API
- **AND** 结果已包含全文，不需要额外提取

#### Scenario: Tavily 后端
- **WHEN** provider 为 tavily 且 tavily_api_key 存在
- **THEN** 调用 Tavily API
- **AND** 对内容 < 200 字符的结果补提取全文

#### Scenario: 无可用后端
- **WHEN** 配置的后端不可用（Docker 未运行 / key 无效 / 未配置）
- **THEN** 返回空结果数组
- **AND** logger 输出警告
