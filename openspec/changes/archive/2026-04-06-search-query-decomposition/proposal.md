## Why

Agent 在搜索阶段构造的 query 关键词堆砌严重（如 `"三国 曹魏 蜀汉 东吴 政治制度 官制"`），导致搜索引擎返回的内容偏向综述型浅层文章，且不同 query 之间结果严重重叠（实测 3 个不同 query 返回完全相同的 3 条结果）。核心原因是 LLM 试图用单个 query 覆盖整个维度，而搜索引擎的最佳输入应该是聚焦单一概念的精准查询。

## What Changes

- 在 capture agent 的 system prompt 中增加搜索策略约束，限制每个 query 的关键词数量和语义聚焦度
- 细化 `generateSearchPlan` 的模板粒度，将宽泛的维度模板拆分为更具体的子话题查询
- 在 search tool 层增加结果 URL 去重机制，避免多次搜索返回相同页面浪费 token
- 调整 Exa 搜索参数，利用其 semantic search 特性优化查询方式

## Capabilities

### New Capabilities
- `search-query-constraints`: Agent 搜索 query 的构造约束规则，包括关键词数量限制、语义聚焦规则、搜索引擎特性适配

### Modified Capabilities
- `search-planning`: planSearch 模板粒度细化，从每维度 2-3 条宽泛 query 改为每维度 3-5 条聚焦子话题 query
- `agent-tool-loop`: search tool 增加跨搜索的 URL 去重，避免重复结果

## Impact

- `src/agent/soul-capture-strategy.ts` — system prompt 增加搜索约束规则
- `src/agent/world-capture-strategy.ts` — 同上
- `src/agent/soul-dimensions.ts` — 搜索模板细化
- `src/agent/world-dimensions.ts` — 搜索模板细化
- `src/agent/tools/search-factory.ts` — search tool 增加 URL 去重
- `src/agent/tools/exa-search.ts` — 优化 Exa 搜索参数
- 现有测试需要更新搜索模板相关的断言
