## Context

当前链路：Agent search → extraction (1句) → cluster (1:1) → extract ("concise") → entry (1句)

实测三国 world：34 条 extraction、31 个 cluster、31 个 entry，67% 是浅层碎片。好的 entry（如 liu-bei.md, zhuge-liang.md）来自 agent 偶尔提取了较长内容的情况，说明问题不在 LLM 能力，而在指令层。

## Goals / Non-Goals

**Goals:**
- Agent 单条 extraction 从 1 句提升到 200-500 字的完整段落
- 每维度 3-5 条 extraction（维度内既有深度又有覆盖）
- World entry 从 1 句话提升到 5-10 句，包含因果分析和机制解释
- 同维度重复 entry 自动合并

**Non-Goals:**
- 不改变维度模型（8 个 soul 维度、9 个 world 维度保持不变）
- 不改变搜索策略（已在 search-query-decomposition 中优化）
- 不改变 entry 的存储格式（frontmatter + markdown）
- 不引入外部知识库或预置内容

## Decisions

### Decision 1: Agent extraction 从"一事实一条"改为"一段落一条"

**选择**: 重写 SOUL_SYSTEM_PROMPT 和 WORLD_SYSTEM_PROMPT 中的 Extraction Guidelines 段落。

**Soul prompt 核心改动**:
```
旧: "Each extraction = ONE distinct piece of information"
    "aim for 3-8 per covered dimension, 20-40 total"

新: "Each extraction = ONE coherent paragraph (200-500 characters)"
    "aim for 3-5 per covered dimension, 15-30 total"
    "Copy full paragraphs verbatim — do NOT condense into single sentences"
    "For quotes dimension: group 3-5 related quotes with context into one extraction"
```

**World prompt 核心改动**:
```
旧: "aim for 3-6 per covered dimension, 25-50 total"

新: "aim for 3-5 per covered dimension, 20-35 total"
    "Each extraction MUST be a full paragraph (200-500 characters)"
    "Include context, causes, and consequences — not just facts"
    "BAD: '200年官渡之战，曹操大败袁绍' (just a date + outcome)"
    "GOOD: full paragraph explaining why the battle happened, the tactics used, and its impact"
```

**Why**: 从日志看 agent 完全有能力 copy 长段落（搜索结果中有 3000 字的页面内容），但 "one fact" 指令让它主动压缩。改变指令就能改变行为。

### Decision 2: 强制 extractPage 用于深度搜索结果

**选择**: 在 agent system prompt 的 Collection 阶段加入规则：

```
"After searching, if a result snippet is under 300 characters but the topic is important,
 you MUST call extractPage to get the full content before extracting."
"For REQUIRED dimensions (identity/quotes/expression for soul, geography/history/factions for world),
 extractPage at least 2 promising URLs to ensure paragraph-level content."
```

**Why**: 从日志看 Exa 返回的 snippet 截断到 3000 chars，但很多高质量页面（如维基百科的三国行政区划）有 10000+ 字。Agent 已有 extractPage tool 但几乎不用——因为 prompt 没有鼓励使用。

**Trade-off**: extractPage 每次调用需要 1-3 秒，增加 2-4 次 extractPage 调用大约增加 5-10 秒总时间。可接受。

### Decision 3: World distill 从 per-cluster 改为 per-dimension merge-then-expand

**选择**: 重构 `WorldDistiller.extractEntries()`：

```
旧流程: clusters[] → forEach(cluster → LLM → 1 entry) → entries[]
新流程: clusters[] → groupByDimension → forEach(dimension → merge all chunks → LLM → 2-5 entries) → entries[]
```

具体实现：
1. 跳过 clusterChunks 的细粒度拆分，直接按 scope:dimension 分组
2. 每个 dimension 的所有 chunks 合并为一个大文本
3. 新 prompt 要求 LLM 从大文本中提取 2-5 个 entry，每个 entry 5-10 句
4. 增加 content 截断限制从 4000 → 8000 字符

**新 extract prompt 要点**:
```
"From the provided text about [dimension], generate 2-5 world entries.
 Each entry should be 5-10 sentences, explaining WHY and HOW, not just WHAT.
 Include causes, consequences, mechanisms, and relationships.
 Output a JSON array of entries."
```

**Why**: Per-cluster 在 cluster 只有 1 个 chunk 时退化为 passthrough。Per-dimension 保证 LLM 看到该维度的全部素材，有足够上下文做深度合成。

### Decision 4: 新增 review 阶段

**选择**: 在 extractEntries 后增加 `reviewEntries()` 阶段：

1. 将所有生成的 entry 发送给 LLM
2. LLM 识别：重复可合并的 entry、过于浅层的 entry（< 2 句）
3. 返回：合并指令 + 需要删除的 entry index
4. 执行合并

**prompt 要点**:
```
"Review these world entries. Identify:
 1. Entries that overlap significantly and should be merged (return merge pairs)
 2. Entries with less than 2 sentences that add no value (return delete indices)
 Output JSON: { merges: [[idx1, idx2], ...], deletes: [idx, ...] }"
```

**Why**: 即使 per-dimension 合成减少了碎片，不同维度之间仍可能产生重叠（如 history 和 factions 都提到同一事件）。Review 是最后一道去重防线。

**Trade-off**: 增加 1 次 LLM 调用。输入是所有 entry 的标题+前 100 字，token 开销约 2000-3000。

## Risks / Trade-offs

- **[Agent step 消耗增加]** → 强制 extractPage 增加 2-4 步。现有 30/35 步上限足够覆盖，但边界情况可能更紧。缓解：仅对 REQUIRED 维度强制 extractPage。
- **[Distill 时间增加]** → per-dimension merge 的输入更长（8000 chars vs 4000），review 增加 1 次 LLM 调用。预计总增加 20-30 秒。可接受。
- **[LLM JSON 解析风险]** → 新 extract prompt 要求返回 JSON 数组而非单对象。GLM-5 对 JSON 数组的稳定性需验证。缓解：保留 fallback 逻辑。
- **[extraction 数量减少]** → 从 20-50 条降到 15-35 条。总 token 量可能反而持平（每条更长）。
