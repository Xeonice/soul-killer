## Why

搜索相关代码散落在 `src/engine/searxng.ts` 和 `src/agent/tools/` 目录中，结构不合理。同时存在独立的 `web-search.ts`（DuckDuckGo）和 `wikipedia-search.ts`，但实际上 SearXNG 和 Exa ���已内置多源搜索（包含 Wikipedia），这些独立实现不再需要。需要整合搜索后端、引入 Exa 作为第三选项、清理冗余文件。

## What Changes

- 新增 Exa 搜索后端（`exa-js` SDK，`searchAndContents` 直接返回全文，无需 page extraction）
- 将 `src/engine/searxng.ts` 移到 `src/agent/tools/searxng-search.ts`（与其他搜索实现同级）
- 新增 `src/agent/tools/exa-search.ts`
- ���除 `src/agent/tools/web-search.ts`（DuckDuckGo HTML 抓取，已被 CAPTCHA 封杀）
- 删除 `src/agent/tools/wikipedia-search.ts`（SearXNG/Exa 都内置 Wikipedia 搜索）
- 删除 `src/agent/tools/tavily-search.ts` 中的 schema 导出（仅保留 execute 函数）
- 简化 `search-factory.ts`：移除 Wikipedia tool schema 引用，search tool 的 source 参数从 `['web', 'wikipedia']` 简化为只有 `'web'`（wikipedia 由搜索后端自动聚合）
- **BREAKING**: agent 不再有独立的 `source: 'wikipedia'` ���项，Wikipedia 内容由搜索后端自动包��
- config schema: `SearchProvider` 加 `'exa'`，search 加 `exa_api_key`
- setup wizard: 搜索引擎三选一（SearXNG / Exa / Tavily）
- i18n: 新增 Exa 选项描述

## Capabilities

### New Capabilities

- `exa-search-backend`: Exa API 搜索后端实现

### Modified Capabilities

- `agent-tool-loop`: search tool 简化（移除 wikipedia source），搜索后端三选一
- `search-fallback-chain`: 降级链更新为 SearXNG → Exa → Tavily → DuckDuckGo(deprecated)

## Impact

- 新增 `exa-js` 依赖
- 移动 `src/engine/searxng.ts` → `src/agent/tools/searxng-search.ts`
- 新增 `src/agent/tools/exa-search.ts`
- 删除 `src/agent/tools/web-search.ts`、`src/agent/tools/wikipedia-search.ts`
- 修改 `src/agent/tools/search-factory.ts` — 大幅简化
- 修改 `src/config/schema.ts`、`src/config/setup-wizard.tsx`
- 修改 `src/agent/soul-capture-agent.ts` — import 路径
- 修改 CAPTURE_SYSTEM_PROMPT — 移除 wikipedia source 引导
- 更新 i18n（zh/en/ja）
