## 1. SearchStrategy 接口与策略实现

- [x] 1.1 创建 `src/agent/strategies/types.ts` — 定义 SearchStrategy 接口和 SearchExecutors 类型（从 soul-capture-agent.ts 中迁出）
- [x] 1.2 创建 `src/agent/strategies/digital-construct.ts` — DuckDuckGo 搜 wiki/character + 页面提取 + Wikipedia 补充
- [x] 1.3 创建 `src/agent/strategies/public-entity.ts` — Tavily 搜采访/观点 + Wikipedia
- [x] 1.4 创建 `src/agent/strategies/historical-record.ts` — Wikipedia 深度提取为主 + Tavily 补充
- [x] 1.5 创建 `src/agent/strategies/index.ts` — `getStrategyForClassification()` 分类到策略的映射

## 2. 集成到 captureSoul

- [x] 2.1 重写 `soul-capture-agent.ts` 的 Step 3：移除 SEARCH_TEMPLATES 和模板循环，替换为 `getStrategyForClassification()` + `strategy.search()`
- [x] 2.2 将 SearchExecutors 接口迁移到 `strategies/types.ts`，soul-capture-agent.ts 引用之

## 3. 测试

- [x] 3.1 验证现有测试全部通过
- [x] 3.2 修复 DuckDuckGo URL 提取 + 替换 Readability 为 Jina Reader
