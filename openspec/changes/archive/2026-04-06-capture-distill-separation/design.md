## Context

当前数据流: Capture(搜索+深读+提取) → extractions 退化成 SoulChunk → 写临时 .md → Distill(重新分类+重新提取)。两个阶段重复做提取工作，且 distill 看到的数据比 capture 差（丢失了 dimension 标签和全文内容）。

## Goals / Non-Goals

**Goals:**
- Planning Agent 为每个维度生成质量评分标准，让 Capture Agent 有明确的筛选依据
- Capture Agent 聚焦搜集和质量筛选，不做深度阅读和提取
- Distill 直接读取维度缓存的原始全文，按维度并行蒸馏
- 消除重复蒸馏
- 兼容 markdown/URL 数据源

**Non-Goals:**
- 不改变搜索引擎后端
- 不改变 Planning Agent 的维度规划逻辑（只扩展输出）
- 不改变 entry 的存储格式

## Decisions

### Decision 1: DimensionDef 增加 qualityCriteria

```typescript
interface DimensionDef {
  // ...existing fields...
  qualityCriteria: string[]  // 文章质量标准（由 Planning Agent 生成）
  minArticles: number        // 该维度最少需要几篇合格文章
}
```

Planning Agent 的 prompt 增加要求：为每个维度生成 2-4 条质量标准，以及 minArticles（required 维度 3-5，supplementary 维度 2-3）。

Capture Agent 的 system prompt 注入这些标准，agent 在 evaluateDimension 时对照标准判断。

### Decision 2: Capture Agent 工具集简化

移除:
- readFullResult — 深度阅读交给 distill
- extractDimension — 提取交给 distill

保留:
- evaluateDimension — 预览文章列表，对照 qualityCriteria 判断质量
- supplementSearch — 补充搜索
- reportFindings — 只报 classification + origin + summary，extractions 字段移除

reportFindings 的 inputSchema 简化:
```typescript
z.object({
  classification: z.enum([...]),
  origin: z.string().optional(),
  summary: z.string(),
  dimensionStatus: z.array(z.object({
    dimension: z.string(),
    qualifiedArticles: z.number(),
    sufficient: z.boolean(),
  })),
})
```

agent 不再提交 extractions，只报告每个维度的合格文章数和是否充分。

### Decision 3: CaptureResult 产出维度缓存路径

```typescript
interface CaptureResult {
  classification: string
  origin?: string
  summary: string
  sessionDir: string           // 维度缓存目录路径
  dimensionPlan: DimensionPlan
  elapsedMs: number
}
```

不再产出 `chunks: SoulChunk[]`。维度缓存在磁盘上，distill 直接读取。

### Decision 4: Distill 新增 distillFromCache 方法

```typescript
class WorldDistiller {
  // 新方法: 从维度缓存蒸馏
  async distillFromCache(
    worldName: string,
    sessionDir: string,
    dimensionPlan: DimensionPlan,
  ): Promise<GeneratedEntry[]>

  // 现有方法保留: 从 markdown/URL 数据源蒸馏（走 classify 流程）
  async distill(
    worldName: string,
    sourcePath: string,
    adapterType: AdapterType,
    ...
  ): Promise<GeneratedEntry[]>
}
```

`distillFromCache` 流程:

```
1. 读取 sessionDir 中每个 {dimension}.json 文件
2. 按维度并行 (并发 3-5):
   对每个维度:
     a. 读取该维度的所有 SearchResult（原始全文）
     b. LLM 调用: "从这些文章中蒸馏出 entry"
        - 输入: 维度描述 + 所有文章全文（拼接，截断到 8000 chars）
        - 输出: JSON 数组，每个 entry 有 name/keywords/priority/content
        - content 要求: 5-10 句，解释因果和机制
     c. 解析 JSON，生成 GeneratedEntry[]
3. 合并所有维度的 entry
4. review: LLM 去重
5. 返回 GeneratedEntry[]
```

### Decision 5: world-create-wizard 流程适配

```
之前:
  capture → agentChunks → 写临时 .md → distiller.distill(tmpDir)

之后:
  capture → CaptureResult { sessionDir } → distiller.distillFromCache(sessionDir, dimensionPlan)
```

不再中转 SoulChunk，直接传维度缓存路径。

## Risks / Trade-offs

- **[CaptureResult 不再有 chunks]** 下游依赖 chunks 的代码需要适配。主要是 world-create-wizard 的 UI 显示和 batch-pipeline。
- **[distillFromCache 的并行控制]** 13 个维度并行调 LLM 可能触发 rate limit。控制并发 3-5。
- **[markdown/URL 数据源仍需 classify]** distill 的旧方法保留，两条路径并存。但公共的 extractEntries 和 review 可复用。
