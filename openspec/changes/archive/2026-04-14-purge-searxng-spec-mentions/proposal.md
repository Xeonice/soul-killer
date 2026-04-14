## Why

`remove-searxng-backend` 已归档了 `searxng-backend` 与 `search-fallback-chain` 两个能力规范，但 SearXNG 在三处旁路活跃规范中仍被例举：`agent-session-log`（META 头示例与"SearXNG search internals"场景）、`agent-tool-loop`（搜索后端列举 + 专属场景）、`domain-directory-layout`（`infra/search/` 文件名清单）。这些遗留例举与代码层（已删除 SearXNG）和能力层（已 REMOVED）皆不一致，会误导未来的实现者，也会让 grep 审计永远漏掉清扫工作。

## What Changes

- **agent-session-log**：把 META 头示例的 provider 从 `"searxng"` 换成 `"exa"`；把"SearXNG search internals"场景整条 REMOVED（该场景描述了 SearXNG 专有的 page-extraction 步数等内部细节，没有对应 Exa/Tavily 等价物）。
- **agent-tool-loop**：把"搜索工具集"requirement 描述里的 `SearXNG/Exa/Tavily` 改为 `Exa/Tavily`；把"简化后的搜索调用"场景里同样的列举改写；把"search tool 使用 SearXNG"场景 REMOVED。
- **domain-directory-layout**：`infra/search/` 文件清单去掉 `searxng`。
- 不涉及任何运行时代码改动。

## Capabilities

### New Capabilities
（无）

### Modified Capabilities
- `agent-session-log`：MODIFIED `META header in log file` requirement（更新示例 provider）；REMOVED `Tool internal detail logging` 下的 `SearXNG search internals` 场景—但因 spec 工具不支持单场景 REMOVED，整条 requirement 必须改为 MODIFIED 重写。
- `agent-tool-loop`：MODIFIED `搜索工具集` requirement（去 SearXNG 描述与场景）。
- `domain-directory-layout`：MODIFIED `基础设施目录` requirement（搜索后端清单去 searxng）。

## Impact

- 文档：3 个活跃 spec 文件；不动归档目录。
- 代码：无。
- 行为：无变化——SearXNG 在前序两次提交里已彻底下线，本提案是文档侧最后一道清扫。
- 破坏性：无。
