## Context

当前 `DimensionDef.source` 有 `'base'` 和 `'extension'` 两种。base 维度由 `SOUL_BASE_DIMENSIONS` / `WORLD_BASE_DIMENSIONS` 定义，Planning Agent 不可删除它们，只能调整 priority/description 和新增 extension。

实测三国场景：species（族群）和 atmosphere（氛围）对三国不适用，但因为是 base 维度被强制保留，导致评分永远不达标，补搜 3 轮也没用。

## Goals / Non-Goals

**Goals:**
- Planning Agent 基于模版自由选择、裁剪、合并维度，输出完全动态的维度列表
- 消除"base 不可删除"的硬约束
- 模版只提供参考和灵感，不强制包含

**Non-Goals:**
- 不改变搜索/评分/distill 流程
- 不改变 entry 存储格式

## Decisions

### Decision 1: DimensionSource 简化为 'planned'

所有由 Planning Agent 输出的维度统一标记 `source: 'planned'`。不再区分来源。

### Decision 2: 模版重命名

`SOUL_BASE_DIMENSIONS` → `SOUL_DIMENSION_TEMPLATES`
`WORLD_BASE_DIMENSIONS` → `WORLD_DIMENSION_TEMPLATES`

语义明确：这些是模版，不是强制基础维度。

### Decision 3: Planning Agent prompt 重写

从：
```
## Base Dimensions (cannot be deleted)
[列出所有 base 维度]
You can:
1. Adjust base dimensions (change priority/description)
2. Add extension dimensions (0-6)
```

改为：
```
## Dimension Templates (reference only)
[列出所有模版维度]
You MUST:
1. Select which dimensions are relevant to this target (drop irrelevant ones)
2. Adjust descriptions and qualityCriteria to fit the specific target
3. Add new dimensions if the templates don't cover important aspects
4. Output the COMPLETE final dimension list (6-15 dimensions)
```

### Decision 4: 移除 base 删除校验

`validate()` 中的"基础维度未被删除"检查移除。只保留：
- 总维度数 6-15
- 每个维度有必要字段（name, description, signals, queries, qualityCriteria, minArticles）

## Risks / Trade-offs

- **[Planning Agent 可能删掉重要维度]** 如 history。缓解：模版中标注 "strongly recommended"，prompt 提示"核心维度如 history/geography 通常应保留"。
- **[输出质量依赖 LLM]** 全动态意味着 LLM 如果表现差，可能生成无意义的维度。缓解：校验确保每个维度有完整字段。
