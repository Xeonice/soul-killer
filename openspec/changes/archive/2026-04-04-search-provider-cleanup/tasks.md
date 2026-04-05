## 1. 依赖与配置

- [x] 1.1 安装 `exa-js` 依赖
- [x] 1.2 修改 `config/schema.ts` — SearchProvider 加 `'exa'`，search 加 `exa_api_key`

## 2. 文件整理

- [x] 2.1 将 `src/engine/searxng.ts` 移动到 `src/agent/tools/searxng-search.ts`，更新所有 import 引用
- [x] 2.2 删除 `src/engine/searxng.ts`（确认无残留引用）
- [x] 2.3 删除 `src/agent/tools/web-search.ts`，更新所有引用（search-factory 不再 import 它）
- [x] 2.4 删除 `src/agent/tools/wikipedia-search.ts`，更新所有引用

## 3. Exa 实现

- [x] 3.1 创建 `src/agent/tools/exa-search.ts` — 封装 Exa `searchAndContents` 调用，返回 SearchResult[]

## 4. Tavily 全文适配

- [x] 4.1 修改 `tavily-search.ts` — 改为 `search_depth: 'advanced'` + `include_raw_content: 'markdown'`，结果直接包含全文

## 5. search-factory 重构

- [x] 5.1 重写 search tool — 移除 source/lang 参数，简化为只有 query；按 resolvedProvider 选择 SearXNG/Exa/Tavily 后端；Exa 和 Tavily 路径不需要 page extraction，只有 SearXNG 需要
- [x] 5.2 移除 wikipedia-search 和 web-search 的 import
- [x] 5.3 更新 planSearch tool 中的 query templates — 移除 wikipedia source 引用

## 6. Agent 更新

- [x] 6.1 修改 `soul-capture-agent.ts` — import 路径从 `engine/searxng` 改为 `agent/tools/searxng-search`；provider 判断加 exa
- [x] 6.2 更新 CAPTURE_SYSTEM_PROMPT — 移除 wikipedia source 指导，简化搜索指令
- [x] 6.3 更新 fullStream 事件映射 — search tool 不再有 source 区分，统一为 'search'

## 7. Setup wizard + i18n

- [x] 7.1 修改 setup-wizard — 搜索引擎从二选一改为三选一（SearXNG / Exa / Tavily）；选 Exa 时输入 API key
- [x] 7.2 添加 Exa 相关 i18n key（zh/en/ja）

## 8. 维度系统适配

- [x] 8.1 更新 `dimensions.ts` 的 SEARCH_TEMPLATES — 移除 wikipedia source 条目，所有查询改为纯 query

## 9. 验证

- [x] 9.1 类型检查通过、现有测试不回退
- [x] 9.2 确认无文件残留引用 web-search.ts / wikipedia-search.ts / engine/searxng.ts
