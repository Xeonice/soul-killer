## Why

`searxng-backend` 能力规范仍在 `openspec/specs/` 中描述 SearXNG 容器生命周期、HTTP 客户端、`engine/searxng/settings.yml` 配置等。但对应的运行时代码（`src/infra/search/searxng-search.ts`、`engine/searxng/`、配置向导入口、capture-agent 与 supplement-search 的 SearXNG 分支、3 套 i18n 文案）已在前序提交中全部移除——SearXNG 实际从未在生产路径稳定支持过。规范不下沉就会成为永久"幽灵能力"，误导未来的实现者和审计者。

## What Changes

- 标记 `searxng-backend` 能力为 REMOVED，归档时连带删除 `openspec/specs/searxng-backend/` 目录。
- 修改 `search-fallback-chain` 规范：从降级链中移除 SearXNG 后端选项与对应场景，保留 Exa / Tavily / 无后端三个分支。
- 不涉及任何运行时代码改动（代码已在前一次会话清理）。

## Capabilities

### New Capabilities
（无）

### Modified Capabilities
- `searxng-backend`: 整能力 REMOVED — SearXNG 后端从未实际投入使用，相关代码已删除。
- `search-fallback-chain`: 把"SearXNG 后端"场景从降级链中删除；调整顶层描述只列举 Exa / Tavily 两条路径。

## Impact

- 文档：`openspec/specs/searxng-backend/spec.md`（archive 时整目录删除）、`openspec/specs/search-fallback-chain/spec.md`（场景缩减）。
- 代码：无（前置会话已清理 `src/infra/search/searxng-search.ts`、`engine/searxng/`、配置向导、capture-agent、supplement-search、tools/index.ts、3 套 i18n、3 个测试文件）。
- 行为：用户角度无新变化——SearXNG 入口在前序提交中已下线，本提案只是把规范层与代码层对齐。
- 破坏性：无。本变更纯粹是文档归档；任何 `config.search.provider === 'searxng'` 的旧配置在前序代码改动里已经会回退到 Exa/Tavily key 自动检测路径。
