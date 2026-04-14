## REMOVED Requirements

### Requirement: SearXNG 容器生命周期管理
**Reason**: SearXNG 后端从未稳定投入生产；运行时代码（`src/infra/search/searxng-search.ts`、`engine/searxng/`）已在前一次提交全部移除，此能力规范应同步归档。
**Migration**: 用户需在 `~/.soulkiller/config.yaml` 的 `search` 段配置 `provider: exa` 或 `provider: tavily`，并提供对应的 API key。`/setup` 与 `/config` 命令现已只展示 Exa / Tavily 两个选项。

### Requirement: SearXNG 搜索执行器
**Reason**: 同上——`searxngSearch()` 函数和整个 `searxng-search.ts` 已删除。
**Migration**: 调用方迁移至 `executeExaSearch()`（`src/infra/search/exa-search.ts`）或 `executeTavilySearch()`（`src/infra/search/tavily-search.ts`）。

### Requirement: SearXNG 配置
**Reason**: `engine/searxng/settings.yml` 与所在目录已删除，无需维护。
**Migration**: 无替代项。
