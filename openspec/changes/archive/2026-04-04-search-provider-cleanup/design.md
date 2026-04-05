## Context

当前搜索代码结构混乱：SearXNG 放在 `engine/`、DuckDuckGo/Tavily/Wikipedia 放在 `agent/tools/`、search tool 有 `web` 和 `wikipedia` 两个 source。实际上 SearXNG 已聚合 Google+Bing+Reddit+Wikipedia，Exa 也自带全文提取。独立的 DuckDuckGo（已被 CAPTCHA）和 Wikipedia（被搜索后端包含）不再需要。

## Goals / Non-Goals

**Goals:**
- 三个搜索后端（SearXNG/Exa/Tavily）统一放在 `src/agent/tools/`
- 删除冗余的 web-search.ts 和 wikipedia-search.ts
- 引入 Exa 作为新后端（`searchAndContents` 直接返回全文）
- search tool 简化为单一 `query` 输入，不再区�� web/wikipedia source
- setup wizard 支持三选一

**Non-Goals:**
- 不改变 agent loop、维度系统、coverage 逻辑
- 不改变 page-extractor.ts（SearXNG 路径仍需要它）

## Decisions

### 1. 文件结构

```
src/agent/tools/
  search-factory.ts       ← 搜索工厂 + AI SDK tool 定义
  searxng-search.ts       ← SearXNG（从 engine/ 移入，含 Docker 管理）
  exa-search.ts           ← Exa（新增）
  tavily-search.ts        ← Tavily（保留 execute 函数）
  page-extractor.ts       ← 页面提取（SearXNG 路径用）

删除:
  web-search.ts           ← DuckDuckGo（CAPTCHA，不可用）
  wikipedia-search.ts     ← Wikipedia（被搜索后端包含）

src/engine/
  searxng.ts              ← 删除（移到 agent/tools/）
```

### 2. Exa 实现

```typescript
// exa-search.ts
import Exa from 'exa-js'

export async function executeExaSearch(apiKey: string, query: string): Promise<SearchResult[]> {
  const exa = new Exa(apiKey)
  const results = await exa.searchAndContents(query, {
    type: 'auto',
    numResults: 10,
    text: { maxCharacters: 3000 },
  })
  return results.results.map(r => ({
    title: r.title ?? '',
    url: r.url,
    content: r.text ?? '',
  }))
}
```

Exa 的 `searchAndContents` 直接返回全文，不需要额外的 page extraction。`maxCharacters: 3000` 与现有 page-extractor 的 `MAX_CONTENT_LENGTH` 对齐。

### 3. search tool 简化

之前：
```typescript
inputSchema: z.object({
  query: z.string(),
  source: z.enum(['web', 'wikipedia']),
  lang: z.enum(['en', 'zh', 'ja']),
})
```

之后：
```typescript
inputSchema: z.object({
  query: z.string(),
})
```

不再区分 source。LLM 只需要提供 query，搜索后端自动聚合多源。Wikipedia 内容通过 SearXNG 的 wikipedia 引擎或 Exa 的语义搜索自然覆盖。

### 4. 降级链

```
config.search.provider === 'searxng' && available → searxngSearch + extractPages
config.search.provider === 'exa' && exa_api_key   → executeExaSearch (自带全文)
config.search.provider === 'tavily' && tavily_key  → executeTavilySearch + extractPages(短结果)
fallback                                           → 空结果 + 警告
```

不再 fallback 到 DuckDuckGo（已死）。如果用户配的后端不可用，返回空结果并 log 警告。

### 5. config schema

```typescript
export type SearchProvider = 'searxng' | 'exa' | 'tavily'

search?: {
  provider?: SearchProvider
  tavily_api_key?: string
  exa_api_key?: string
}
```

### 6. setup wizard 流程

```
选择搜索引擎:
  ▸ SearXNG（本地 Docker，免费，多源聚合）
    Exa（API 服务，语义搜索，自带全文）
    Tavily（API 服务，需要 key）

选 SearXNG → 检查 Docker → 完成/提示安装 Docker
选 Exa     → 输入 API key → 完成
选 Tavily  → 输入 API key → 完成
```

### 7. system prompt 更新

移除 `source: "wikipedia"` 相关指导。搜索指令简化为：
```
Use the search tool with your query. The search engine automatically 
queries multiple sources including web pages, Wikipedia, and forums.
```

## Risks / Trade-offs

**[失去独立 Wikipedia 精确查询]** 之前可以 `search(source: 'wikipedia', lang: 'zh')` 精确查中文 Wikipedia → 现在靠搜索后端自动聚合，可能精确度略降 → SearXNG 配置了 wikipedia 引擎，Exa 语义搜索也能找到 Wikipedia 内容

**[DuckDuckGo fallback 移除]** 没有任何搜索后端配置时无法搜索 → 可接受，setup wizard 强制选择搜索引擎
