## Context

当前 capture-agent.ts 的流程:
1. Pre-search → Planning Agent → DimensionPlan (12 维度, 每维度 2-4 queries)
2. ToolLoopAgent 接管: LLM 自由调用 search/extractPage/planSearch/checkCoverage
3. LLM 自行决定 reportFindings

问题: 步骤 2 中 LLM 完全忽视 DimensionPlan，自由发挥搜索。GLM-5 在单步发出 488 个并行 search 调用。

搜索引擎已返回全文: Tavily 用 `include_raw_content: 'markdown'` 返回完整页面，Exa 的 `maxCharacters: 3000` 可提高。extractPage 是多余层。

## Goals / Non-Goals

**Goals:**
- 搜索阶段完全确定性：代码按 DimensionPlan 的 queries 逐条执行，不由 LLM 决策
- Agent 聚焦质量评估：按维度审查搜索结果，判断是否充分，不足时精准补充
- 搜索总量可预测可控：计划 ~36 条 + 补充上限 ~24 条 = 最多 60 条
- 移除 extractPage 冗余层

**Non-Goals:**
- 不改变 Planning Agent（维度规划不变）
- 不改变 distill 阶段
- 不改变搜索引擎后端（Exa/Tavily 选择逻辑不变）
- 不改变 entry 存储格式

## Decisions

### Decision 1: 搜索阶段从 LLM 驱动改为代码驱动

**选择**: 在 capture-agent.ts 中，Planning Agent 之后、Agent loop 之前，用代码循环执行所有 DimensionPlan queries:

```typescript
// Phase: Deterministic Search
const searchResults: Map<string, SearchResult[]> = new Map()

for (const dim of dimensionPlan.dimensions) {
  const dimResults: SearchResult[] = []
  for (const query of dim.queries) {
    const results = await runSearch(query)
    dimResults.push(...results.results)
  }
  searchResults.set(dim.name, dimResults)
  // 写入文件缓存
  writeDimensionCache(dim.name, dimResults)
}
```

**Why**: 搜索决策已由 Planning Agent 完成。代码执行是确定性的，不会失控。

### Decision 2: Agent 重新定位为质量评估者

**选择**: ToolLoopAgent 不再负责搜索，只负责:
1. 按维度审查搜索结果质量
2. 判断哪些维度需要补充搜索
3. 最终提取 reportFindings

**工具集**:

```
evaluateDimension(dimensionName)
  → 从文件缓存读取该维度的搜索结果
  → 返回给 LLM 审查
  → LLM 判断: sufficient / needs_more

supplementSearch(dimensionName, query)
  → 针对特定维度补充搜索 1 条
  → 每维度上限 2 次补充
  → 结果追加到该维度的缓存

reportFindings(classification, extractions)
  → 同现有逻辑
```

**System prompt 要点**:
```
你是一个研究质量评估师。搜索已经完成，结果按维度组织在缓存中。

你的任务:
1. 逐个维度调用 evaluateDimension，审查搜索结果
2. 如果某维度数据不足，用 supplementSearch 补充（每维度最多 2 次）
3. 审查完所有维度后，调用 reportFindings 提交完整提取

每次 evaluateDimension 会返回该维度的搜索结果全文。
你需要判断:
- 内容是否覆盖了该维度的描述
- 内容深度是否足够（有因果分析、具体事实、直接引用）
- 是否需要补充搜索
```

**Why**: Agent 有 LLM 的判断力来评估内容质量，这是代码做不了的。但搜索决策权不给它——只给补充权，且有上限。

### Decision 3: 移除 extractPage，提高搜索引擎返回量

**选择**:
- Exa: `maxCharacters` 从 3000 提高到 10000
- Tavily: 已有 `include_raw_content: 'markdown'`，无需改动
- 移除 extractPage 工具的创建和使用

**Why**: 搜索引擎 API 本身支持全文返回。3000 chars 对于深度内容不够，10000 chars 覆盖大多数文章。extractPage 的 HTTP 抓取+Readability 解析是额外的网络开销和失败点。

### Decision 4: 文件缓存按维度组织

**选择**: 搜索结果按维度存入文件缓存:

```
~/.soulkiller/cache/search/
  {sessionId}/
    geography.json      → [SearchResult, ...]
    history.json        → [SearchResult, ...]
    military-strategy.json → [SearchResult, ...]
```

`evaluateDimension` 从对应文件读取全部结果返回给 LLM。`supplementSearch` 追加到对应文件。

**Why**: 按维度组织让 Agent 一次审查一个维度的全部数据，不需要跨维度扫描。文件缓存比内存缓存更可靠。

## Risks / Trade-offs

- **[搜索质量依赖 Planning Agent]** Planning Agent 生成的 queries 如果不好，搜索结果也不好。缓解: supplementSearch 让 Agent 有有限的补充能力。
- **[evaluateDimension 上下文开销]** 一个维度可能有 20-40 条搜索结果的全文，每条 3000-10000 chars。缓解: evaluateDimension 返回时每条结果截断到 1500 chars（轻量预览），Agent 可用 readSearchDetails 读取全文。
- **[Agent 步数]** 12 维度 × (1次 evaluate + 可能的 supplement) + 1次 report ≈ 15-25 步。maxSteps 设为 30 足够。
