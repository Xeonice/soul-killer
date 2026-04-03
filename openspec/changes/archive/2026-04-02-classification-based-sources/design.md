## Context

当前 Step 3 深度搜索流程：遍历 `SEARCH_TEMPLATES[classification]` 关键词模板 → 全部通过 Tavily 搜索。实测 Tavily 对虚构角色返回 0 results，对公众人物效果尚可。项目已有 DuckDuckGo 搜索（`web-search.ts`）和 Readability 页面提取（`page-extractor.ts`），只是没有在深度搜索中使用。

## Goals / Non-Goals

**Goals:**
- 虚构角色能搜到 fandom wiki 等高质量内容
- 每种分类使用最适合的搜索引擎
- 复用已有的 DuckDuckGo + Readability 代码

**Non-Goals:**
- 新增搜索引擎 API（不引入 SerpAPI/Google CSE）
- 修改 Step 1（初始搜索）和 Step 2（分类）逻辑
- 修改相关性过滤逻辑

## Decisions

### D1: SearchStrategy 接口

```typescript
interface SearchStrategy {
  search(
    englishName: string,
    chineseName: string,
    origin: string,
    executors: SearchExecutors,
    onProgress?: OnProgress,
  ): Promise<WebSearchExtraction[]>
}
```

每个分类对应一个策略，`captureSoul` 的 Step 3 简化为：
```typescript
const strategy = getStrategyForClassification(classification)
const deepExtractions = await strategy.search(englishName, cn, origin, executors, onProgress)
```

### D2: 各分类策略

**DIGITAL_CONSTRUCT 策略:**
1. DuckDuckGo 搜: `"{name} {origin} wiki"`, `"{name} {origin} character"`, `"{cn} {origin} 角色"`
2. 对 DuckDuckGo 返回的 URL 做 Readability 全页面提取（前 3 个结果）
3. 补充: Wikipedia 英文搜 `{name}`

DuckDuckGo 能搜到 `cyberpunk.fandom.com/wiki/David_Martinez`，Readability 提取全文能拿到角色背景、性格、台词等完整信息。

**PUBLIC_ENTITY 策略:**
1. Tavily 搜: `"{name} interview quotes"`, `"{name} personality style"`, `"{name} {origin} views"`
2. Wikipedia 搜 `{name}`
3. 中文补充: Tavily 搜 `"{cn} 观点 理念"`

Tavily 擅长新闻/采访类内容，这正是公众人物需要的。

**HISTORICAL_RECORD 策略:**
1. Wikipedia 英文 + 中文搜 `{name}`（深度提取，取更长内容）
2. Tavily 搜: `"{name} famous quotes"`, `"{name} philosophy contributions"`
3. 中文补充: Tavily 搜 `"{cn} 名言 思想"`

历史人物的 Wikipedia 词条通常很完整，是最佳主信源。

### D3: DuckDuckGo 搜索复用

直接调用 `executeWebSearch(query)` from `web-search.ts`。该函数已经实现了 DuckDuckGo HTML 解析 + 前 3 个结果的页面提取。不需要再单独调 page-extractor。

### D4: 进度事件

每个策略内部的搜索调用仍然 emit `tool_call` / `tool_result` 事件。新增 tool 名称 `duckduckgo` 以区分来源。Protocol Panel 对未知 tool name 默认显示 🔍。

## Risks / Trade-offs

**[DuckDuckGo 速率限制]** 短时间大量请求可能被限制 → 控制并发，每次最多 3 个查询。

**[Readability 提取质量]** 某些 fandom 页面结构特殊，Readability 可能提取不完整 → 已有 3000 字符截断作为兜底。

**[策略选择是硬编码]** 分类到策略的映射是写死的 → 目前三种分类足够，后续可以做成配置。
