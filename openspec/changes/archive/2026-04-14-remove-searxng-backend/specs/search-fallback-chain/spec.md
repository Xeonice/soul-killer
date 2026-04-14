## MODIFIED Requirements

### Requirement: 搜索后端降级链
search tool SHALL 根据 `config.search.provider` 选择后端：Exa（API + 自带全文）、Tavily（API + 自带全文）。当配置的 provider 没有可用 key 时，按 Exa → Tavily 的顺序回退到任意一个有 key 的后端；两者皆无 key 时返回空结果。

#### Scenario: Exa 后端
- **WHEN** provider 为 exa 且 exa_api_key 存在
- **THEN** 调用 Exa searchAndContents API
- **AND** 结果已包含全文，不需要额外提取

#### Scenario: Tavily 后端
- **WHEN** provider 为 tavily 且 tavily_api_key 存在
- **THEN** 调用 Tavily API（advanced + include_raw_content）
- **AND** 结果已包含全文

#### Scenario: 配置 provider 缺 key 时回退
- **WHEN** provider 为 exa 但缺 exa_api_key，仅 tavily_api_key 存在
- **THEN** 自动回退到 Tavily 后端

#### Scenario: 无可用后端
- **WHEN** Exa 和 Tavily 的 key 均未配置
- **THEN** 抛出错误并提示用户在 `~/.soulkiller/config.yaml` 配置 `search.provider`
- **AND** logger 输出警告

## REMOVED Requirements

### Requirement: SearXNG 后端场景
**Reason**: SearXNG 后端代码已删除，降级链不再包含此分支。
**Migration**: 用户改用 Exa 或 Tavily（见 setup-wizard / `/config`）。
