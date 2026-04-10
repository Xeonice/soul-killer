## Context

Planning Agent (`src/agent/planning/planning-agent.ts`) 基于 pre-search 侦察结果和维度模板生成搜索计划。当前 prompt 关注维度选择、多语言覆盖和 query 格式，但没有区分"世界内事实"和"作品 meta 信息"。`classification` 字段（`FICTIONAL_UNIVERSE` / `REAL_SETTING` / `UNKNOWN_SETTING`）被传入但未在 prompt 中做条件分支。

对于 Cyberpunk 2077 这类幻想世界，搜索引擎天然返回世界内信息（"夜之城"搜不到制作信息）。但对于 White Album 2 这类现实背景作品，"White Album 2 历史 时间线"返回的是游戏发售日、动画播出日、声优阵容等 meta 信息。

`WORLD_DIMENSION_TEMPLATES` 中的 `qualityCriteria` 也没有 meta 排斥条目。

## Goals / Non-Goals

**Goals:**
- Planning Agent prompt 中增加世界内信息的明确定义和 meta 排斥指令
- 基于 classification 对 `REAL_SETTING` 类世界启用更严格的 query 限定策略
- WORLD_DIMENSION_TEMPLATES 的 qualityCriteria 增加默认 meta 排斥条目

**Non-Goals:**
- 不修改 distill 层的 IN-WORLD ONLY prompt（保留作为安全网，不在本次 scope 内）
- 不修改 soul capture 流程（soul 不存在此问题）
- 不在搜索执行层或 title filter 层增加 meta 过滤（规划层修复已足够）
- 不增加新的 classification 类型

## Decisions

### D1: prompt 增加「搜索目标声明」段落

在 `buildPlanningPrompt()` 的 prompt 中，紧接 "Dimension Templates" 之后、"Rules" 之前，插入一个 **Search Target Declaration** 段落：

```
## Search Target: In-World Information ONLY

Your search queries must target **facts that exist INSIDE the fictional world** —
geography, events, characters, social structures, customs, etc. as they appear in
the story's narrative.

You MUST EXCLUDE queries that would return information ABOUT the work itself:
- Release dates, sales figures, platform ports, remasters
- Anime/manga/drama-CD adaptations, broadcast schedules
- Voice actors, staff, production companies, studios
- Reviews, ratings, awards, merchandise
- Real-world reception, fan community, cultural impact

If you see reconnaissance articles dominated by production/release info, that means
your queries need STRONGER in-world qualifiers (see classification-specific rules below).
```

**理由**：这是最关键的缺失——prompt 从没告诉 LLM "你搜的是世界内事实"。

### D2: 基于 classification 的条件分支

在 prompt 中增加 classification-specific rules：

**FICTIONAL_UNIVERSE** (Cyberpunk 2077, Fate, 三体):
```
This is a fictional universe with unique world-building. Standard queries will
naturally return in-world content. No special qualifiers needed.
```

**REAL_SETTING** (White Album 2, 灌篮高手, 你的名字):
```
This is a story set in the real world (or a close variant). Search engines will
heavily mix production meta-info with in-story facts.

MANDATORY for every query:
- Append qualifiers like "故事内/剧情/设定/in-story/story setting" to disambiguate
- Prefer character names + event descriptions over work title alone
- qualityCriteria for EVERY dimension MUST include:
  "文章描述的是故事世界内部的事实，不是作品的发售/制作/改编/播出信息"

Example bad query:  "White Album 2 历史 时间线"      → returns release dates
Example good query: "白色相簿2 剧情 时间线 故事内事件"  → returns story events
Example good query: "冬马かずさ 北原春希 出来事"        → returns character events
```

**UNKNOWN_SETTING**: 按 `REAL_SETTING` 策略处理（保守策略）。

**理由**：classification 已经存在但未被使用。`REAL_SETTING` 是 meta 污染的高发区，需要特殊对待。

### D3: qualityCriteria 默认 meta 排斥条目

在 `WORLD_DIMENSION_TEMPLATES` 的每个维度的 `qualityCriteria` 数组中追加一条：

```typescript
"排除作品制作、发行、改编、播出、声优、制作组等 meta 信息——只保留故事世界内部的事实"
```

这条由 Planning Agent 继承到输出计划中，在后续的 quality scoring 阶段被 LLM 参考。

**理由**：qualityCriteria 被传递到 quality scoring 阶段。现在没有任何 meta 排斥条目，评分 LLM 不知道该扣分。

## Risks / Trade-offs

**[过度过滤风险]** → `REAL_SETTING` 策略可能过于激进，导致有用的世界信息也被排除。例如 "灌篮高手 湘北高中" 是世界内地点，但如果 query 限定词太强可能搜不到。**缓解**：限定词是 "故事内/剧情/设定" 而非 "排除所有现实信息"，且 Planning Agent 有自由度调整 query。

**[classification 误判]** → 如果 pre-search 阶段将 WA2 误分类为 `FICTIONAL_UNIVERSE`，则不会触发严格策略。**缓解**：`UNKNOWN_SETTING` 默认走严格路径，且 classification 由独立的分类步骤决定，不在本次修改范围内。
