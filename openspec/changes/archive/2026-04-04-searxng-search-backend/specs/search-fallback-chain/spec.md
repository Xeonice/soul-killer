## ADDED Requirements

### Requirement: 搜索后端降级链
search tool 的 web 搜索 SHALL 按以下优先级选择后端：SearXNG（本地 Docker）→ Tavily（有 API key 时）→ DuckDuckGo（HTML 抓取）。降级判断在 agent 初始化时确定，不在每次搜索时重复检测。

#### Scenario: SearXNG 可用
- **WHEN** SearXNG 容器运行中且健康检查通过
- **THEN** web 搜索使用 SearXNG 后端

#### Scenario: SearXNG 不可用但 Tavily key 存在
- **WHEN** SearXNG 不可用且 config 中有 tavily_api_key
- **THEN** web 搜索使用 Tavily API

#### Scenario: SearXNG 和 Tavily 都不可用
- **WHEN** SearXNG 不可用且无 Tavily key
- **THEN** web 搜索使用 DuckDuckGo HTML 抓取（可能被 CAPTCHA）

#### Scenario: SearXNG 运行时失败
- **WHEN** SearXNG 被选为后端但单次搜索请求失败
- **THEN** 该次搜索返回空结果，不降级到其他后端（避免混合不同来源的延迟）
