## Context

Capture agent 使用 LLM（目前是 GLM-5）通过 search tool 自主搜索信息。搜索流程分三阶段：

1. **Pre-search** — `runSearch(name)` 用原始名字搜一次
2. **planSearch** — 根据分类生成搜索模板，每维度 2-3 条 query
3. **LLM 自主搜索** — LLM 根据模板和上下文自由构造 query

实测三国场景暴露的问题：
- LLM 构造的 query 关键词堆砌（6-8 个词），搜索引擎返回综述型浅层内容
- 不同 query 返回完全相同的结果集（3 个 query 返回同样 3 条结果）
- 模板本身也偏宽泛（如 `'{name} technology magic system rules mechanics'` 5 个词并列）

搜索引擎（Exa/Tavily/SearXNG）的共性：精准聚焦的短 query 返回深度内容，模糊的长 query 返回浅层综述。

## Goals / Non-Goals

**Goals:**
- 让 agent 生成的搜索 query 更加聚焦，每个 query 指向一个具体子话题
- 模板层提供更细粒度的示例 query，引导 LLM 生成精准搜索
- 减少跨搜索的结果重叠，提高有效信息密度
- 保持现有搜索流程架构不变（pre-search → planSearch → collect → report）

**Non-Goals:**
- 不改变搜索引擎后端（Exa/Tavily/SearXNG 选择逻辑不变）
- 不引入额外的 query 预处理中间件（避免增加架构复杂度）
- 不改变维度模型（8 个 soul 维度、9 个 world 维度保持不变）
- 不改变 agent 的 step 上限和停止条件

## Decisions

### Decision 1: 通过 system prompt 约束 query 粒度

**选择**: 在 `SOUL_SYSTEM_PROMPT` 和 `WORLD_SYSTEM_PROMPT` 中增加搜索规则段落

**规则内容**:
- 每个 query 最多 4 个有效关键词（name/localName 不计入）
- 每个 query 只查一个子话题，不并列多个概念
- 禁止在一个 query 中放多个人名/地名（如 `"刘备 曹操 孙权 诸葛亮"`）
- 鼓励拆分：如果一个维度有多个方面，分成多次搜索

**Why**: 这是最低成本的改动，直接约束 LLM 的行为。从日志看，LLM 完全可以理解和遵循这类规则（它已经在遵循"不重复搜索同一 query"等规则）。

**备选**: 在 search tool 的 execute 函数中对 query 做自动拆分。弃选原因——搜索引擎的语义理解和简单的字符串拆分不同，自动拆分容易破坏查询意图。

### Decision 2: 模板从宽泛并列改为聚焦子话题

**选择**: 重写 `DIGITAL_CONSTRUCT_TEMPLATES`、`HISTORICAL_RECORD_TEMPLATES`、`REAL_SETTING_TEMPLATES`、`FICTIONAL_UNIVERSE_TEMPLATES`、`REAL_SETTING_TEMPLATES`（world），每个维度从 2-3 条宽泛 query 改为 3-5 条聚焦 query。

**示例** (soul identity 维度):
```
// Before
['{name} {origin} wiki', '{name} character profile', '{localName} 角色 设定 百科']

// After
['{name} {origin} wiki', '{name} character background origin', '{name} biography role',
 '{localName} 角色介绍', '{localName} 人物设定']
```

**示例** (world factions 维度):
```
// Before
['{name} factions organizations groups', '{name} wiki corporations gangs political',
 '{localName} 势力 组织 阵营 派系']

// After
['{name} major factions overview', '{name} political structure government',
 '{name} organizations guilds', '{localName} 主要势力', '{localName} 政治结构']
```

**Why**: 模板是 LLM 看到的"示例"，影响 LLM 后续自主生成 query 的风格。模板本身聚焦，LLM 的模仿也会聚焦。

### Decision 3: search tool 增加 URL 去重

**选择**: 在 `createAgentTools` 中维护一个 `Set<string>` 记录已返回的 URL。每次 `runSearch` 返回结果后，过滤掉已见过的 URL，只返回新结果。

```typescript
const seenUrls = new Set<string>()

async function runSearch(query: string) {
  let results = await executeSearch(query)
  results = results.filter(r => !seenUrls.has(r.url))
  results.forEach(r => seenUrls.add(r.url))
  return { results }
}
```

**Why**: 实测中，3 个不同 query 返回完全相同的 3 条结果——这意味着 LLM 看到了 9 条结果但只有 3 条独立信息，浪费了 token 和 agent 步骤。去重后 LLM 会意识到结果不足，自动换策略搜索。

**风险**: 如果去重后结果为空（所有结果都见过），LLM 可能困惑。缓解：返回空结果时附加提示 `"All results were duplicates of previous searches. Try a different search angle."`

### Decision 4: Exa 搜索参数优化

**选择**: 将 Exa 的 `type: 'auto'` 改为根据 query 特征选择:
- 含中文/日文的 query → `type: 'keyword'`（关键词匹配更精准）
- 纯英文 query → `type: 'auto'`（保持语义搜索优势）

**Why**: Exa 的 semantic search 对中文短语的理解偏弱，容易把不相关但语义相近的结果混入。keyword 模式更适合中文搜索。

**备选**: 始终使用 `type: 'neural'`。弃选原因——neural 模式对中文的精度实测不如 keyword。

## Risks / Trade-offs

- **[搜索次数增加]** → 模板 query 数量从 ~20 增加到 ~35，可能增加搜索 API 调用成本。缓解：agent 的 step 上限不变（soul 30 步、world 35 步），实际搜索次数受限。
- **[Prompt 长度增加]** → system prompt 增加搜索规则段落约 100-150 tokens。影响可忽略。
- **[URL 去重的状态管理]** → `seenUrls` Set 在 agent 生命周期内累积。单次 capture 最多 ~15 次搜索 × 10 结果 = 150 个 URL，内存影响可忽略。
- **[模板变更的向后兼容]** → 模板是内部实现细节，无外部 API 影响。但需要更新相关测试中的模板断言。
