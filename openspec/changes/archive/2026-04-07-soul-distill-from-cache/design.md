## Context

Soul 的 capture agent 已完成维度缓存架构重构：搜索结果按维度存储在 `sessionDir/*.json`（每个文件含 `{ results: [{ title, url, content, _score, _reason }] }`），quality scoring 标记每篇文章的合格状态。

第一轮实现尝试直接将 `sampleChunks` 指向 sessionDir，但测试发现**上下文爆炸**：sessionDir 中的文章是完整网页（5K-30K chars/篇），50 篇返回 ~1M chars，远超模型 163K token 上下文。旧的 SoulChunk 是预分块的小片段（500-2000 chars），粒度完全不同。

需要重新设计 distill agent 的数据读取方式，适配完整文章粒度。

## Goals / Non-Goals

**Goals:**
- Soul 的 web-search 路径 distill 直接从 `sessionDir` 读维度缓存，agent 控制信息摄入量
- 保留 local source（markdown/twitter）的 `SoulChunk[]` 路径不变
- 保留 Soul distill 的跨维度一致性优势（style 参考 identity，ToolLoopAgent 自主决策）

**Non-Goals:**
- 不统一 Soul/World 的 distill 模式（Soul 保留 agent loop，World 保留无 agent 并行）
- 不改动 write tools（writeIdentity/writeStyle/writeBehavior 等）
- 不改动 evolve 流程

## Decisions

### D1: listArticles + readArticle 两级读取（方案 C）

**决策**: sessionDir 路径新增两个 tool 替代 sampleChunks：

```
listArticles(dimension?)
  → [{ index, title, url, dimension, charCount, preview(前200 chars) }]
  轻量列表，agent 浏览全貌

readArticle(index)
  → { content(截到合理长度), source, dimension, title }
  agent 按需逐篇深读，每次只读一篇
```

**理由**: 
- 文章粒度大，不适合一次性全塞。让 agent 先看目录再挑选，信息量完全可控
- agent 可以跨维度浏览（listArticles 不传 dimension），也可以按维度聚焦
- readArticle 单篇读取，即使最长的文章截断后也在安全范围内

**替代方案**:
- 方案 A（sampleChunks 内截断）→ 粗暴丢信息，agent 看到残缺文章
- 方案 B（capture 后预处理分块）→ 多一轮 pipeline，复杂度高
- 方案 D（对齐 World 无 agent 模式）→ 失去 Soul 跨维度一致性

### D2: readArticle 的内容预算

**决策**: readArticle 每篇截到 8000 chars（约 2000 tokens），足够获取文章核心信息。

**理由**: 
- 大多数有价值文章的核心内容在前 8000 chars
- agent 在 25 步内通常读 10-15 篇文章，总计 80K-120K chars ≈ 20K-30K tokens，安全
- 如果文章被截断，返回 `truncated: true` 标记，agent 知道有更多内容

### D3: sampleChunks 保留给 local source

**决策**: `sampleChunks` tool 仅在 `chunks` 路径（local source）时注册。sessionDir 路径不注册 sampleChunks，只注册 listArticles + readArticle。

**理由**: 两套 tool 服务两种数据粒度，互不干扰。system prompt 根据路径动态调整工作流建议。

### D4: system prompt 动态适配

**决策**: `buildDistillPrompt` 根据数据源生成不同的工作流建议：
- sessionDir 路径：先 listArticles 浏览 → readArticle 按维度深读 → 写文件
- chunks 路径：保留现有 sampleChunks 工作流不变

### D5: distillSoul 签名 options object（已实现）

已在 create.tsx 和 batch-pipeline.ts 完成调用点更新。distill-agent.ts 的签名变更待重新实现。

### D6: 文章索引构建

**决策**: distillSoul 启动时，如果是 sessionDir 路径，预先读取所有维度 JSON 构建文章索引（`articleIndex: { title, url, dimension, charCount }[]`），供 listArticles 和 readArticle 使用。

**理由**: 避免每次 tool 调用都读文件系统。索引很小（标题+URL），可以放内存。

## Risks / Trade-offs

- **[Risk] agent 步数消耗** → 两级读取比 sampleChunks 多消耗步数。但 MAX_STEPS=25 足够（list 1-2 次 + read 10-15 次 + write 5-8 次 + review 1 次 + finalize 1 次）
- **[Risk] 截断丢信息** → 8000 chars 截断可能丢失文章尾部。可通过 _score 排序优先读高质量文章缓解
- **[Risk] batch pipeline 变更面** → 已完成，通过 options object 降低破坏风险
