## Why

当前 Step 3（深度搜索）对所有分类类型使用同一套搜索引擎（Tavily + Wikipedia），只是换关键词模板。实测发现 Tavily 对虚构角色的覆盖极差（"David Martinez Cyberpunk Edgerunners" 返回 0 results），而项目中已有的 DuckDuckGo + Readability 页面提取能力可以轻松搜到 fandom wiki 等高质量信息源。不同类型的目标有不同的最佳信息源，应该根据分类结果选择搜索策略。

## What Changes

- Step 3 深度搜索从"按分类换关键词模板"改为"按分类选搜索引擎+策略"
- `DIGITAL_CONSTRUCT`: 使用 DuckDuckGo 搜索（命中 fandom wiki 等）+ Readability 提取全页内容
- `PUBLIC_ENTITY`: 保持 Tavily（擅长新闻/采访类内容）+ Wikipedia
- `HISTORICAL_RECORD`: Wikipedia 多语言深度提取为主 + Tavily 补充
- 将搜索策略抽象为 `SearchStrategy` 接口，每个分类对应一个策略实现

## Capabilities

### New Capabilities
- `search-strategy`: 按分类选择搜索策略的抽象层——定义 SearchStrategy 接口，为每种分类提供专属搜索策略

### Modified Capabilities
- `soul-capture-agent`: Step 3 从模板搜索改为策略派发

## Impact

- `src/agent/soul-capture-agent.ts` — Step 3 重写为策略派发
- 新增 `src/agent/strategies/` 目录 — 三个策略实现
- `src/agent/tools/web-search.ts` — `executeWebSearch` 被策略直接调用（已有代码复用）
- `src/agent/tools/page-extractor.ts` — 被 DIGITAL_CONSTRUCT 策略调用提取 fandom 页面
