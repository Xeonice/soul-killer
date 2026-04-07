## Why

当前 capture agent 使用 ToolLoopAgent 让 LLM 自主决定搜索策略。实测三国演义场景中，LLM 在单步发出 488 个并行 search 调用，搜索了大量无意义的关键词（"服饰文化 官服 民服"、"货币金融 五铢钱"等），完全忽视了 Planning Agent 已生成的维度计划。

根本问题：Planning Agent 生成了清晰的任务清单（12 维度 × 2-4 queries = ~36 条），但 LLM 拿到计划后自由发挥，没有按计划执行。搜索决策不应该交给 LLM——Planning Agent 已经做了这个决策。

同时 extractPage 工具是多余的——Tavily 已经返回 raw_content（全文 markdown），Exa 返回 3000 chars 内容。搜索引擎本身已给足内容，不需要二次抓取。

## What Changes

- 重构 capture pipeline：搜索阶段从"LLM 自主搜索"改为"代码按计划执行"
- Agent 的角色从"搜索决策者"变为"质量评估者"：按维度评估搜索结果质量，不足时补充搜索（有上限）
- 移除 extractPage 工具——搜索引擎已返回全文，提高 Exa maxCharacters 到完整页面
- 移除 planSearch 工具——计划已由 Planning Agent 在 agent 外部生成
- 简化 Agent 工具集：evaluateDimension + supplementSearch + reportFindings
- 搜索总量可预测：清单 ~36 条 + 每维度补充上限 2 条 = 最多 ~60 条

## Capabilities

### New Capabilities
- `deterministic-search-executor`: 代码层按 DimensionPlan 的 queries 逐条执行搜索，结果按维度分组存入文件缓存
- `dimension-quality-evaluator`: Agent 按维度评估搜索结果质量，判断是否需要补充搜索

### Modified Capabilities
- `soul-capture-agent`: system prompt 重写，从搜索指令改为质量评估指令
- `world-capture-agent`: 同上
- `agent-tool-loop`: 工具集简化为 evaluateDimension + supplementSearch + reportFindings

## Impact

- 重写 `src/agent/capture-agent.ts` — 搜索阶段改为代码执行，Agent 只做质量评估+提取
- 重写 `src/agent/tools/search-factory.ts` — 移除 search/extractPage/planSearch/checkCoverage，新增 evaluateDimension/supplementSearch
- 修改 `src/agent/soul-capture-strategy.ts` — system prompt 重写
- 修改 `src/agent/world-capture-strategy.ts` — 同上
- 修改 `src/agent/tools/exa-search.ts` — maxCharacters 提高
- 移除 `src/agent/tools/page-extractor.ts` 的使用（保留文件但不再被 capture 调用）
