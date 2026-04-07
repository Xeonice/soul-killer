## Context

当前 agent 工作流：
```
for each dimension:
  evaluateDimension → 5条×500chars 预览 → 判断够不够
  (可选) supplementSearch
reportFindings → 14 条 extractions (每维度仅 1 条)
```

磁盘缓存有 300+ 条全文结果，但 agent 只看到了预览片段。evaluateDimension 的目的是快速判断质量，不是深度阅读。需要一个中间环节让 agent 逐条读取全文并提取多条 extractions。

## Goals / Non-Goals

**Goals:**
- Agent 按维度深度阅读全文，每维度提取 3-5 条高质量 extractions
- 最终 reportFindings 的 extractions 数量从 14 提升到 40-60
- 不爆上下文：每次只读 1 条全文，提取后释放

**Non-Goals:**
- 不改变确定性搜索阶段
- 不改变 Planning Agent
- 不改变 distill 阶段

## Decisions

### Decision 1: 按维度分段提取，不在 reportFindings 一次性提取

**选择**: 新增 `extractDimension` 工具，agent 每处理完一个维度就提交该维度的 extractions。reportFindings 只做最终汇总。

工作流变为：
```
for each dimension:
  1. evaluateDimension → 预览列表，判断质量
  2. readFullResult(index=0) → 读第1条全文
  3. readFullResult(index=1) → 读第2条全文
  4. readFullResult(index=2) → 读第3条全文
  5. extractDimension(dimensionName, extractions[]) → 提交 3-5 条
  (可选) supplementSearch
reportFindings(summary, classification) → 只提交汇总信息，extractions 从之前的 extractDimension 累积
```

**Why**: 如果让 agent 把所有维度的全文都读完再一次性 reportFindings，上下文会爆。按维度分段提取，每个维度读 3-5 条全文（每条 3000-10000 chars），提取后 context 可以继续复用。extractDimension 把 extractions 存在内存里，reportFindings 时合并。

### Decision 2: readFullResult 按 index 读取单条全文

**选择**: `readFullResult(dimensionName, index)` 从维度缓存读取第 index 条的完整 content 返回给 agent。

一次只读一条，避免上下文膨胀。agent 可以连续调用多次读不同的 index。

### Decision 3: maxSteps 大幅提升

**选择**: 每维度需要 ~5 步（1 evaluate + 3 reads + 1 extract），13 维度 = 65 步，加上 supplement 和 reportFindings，maxSteps 设为 80。

但 ToolLoopAgent 的上下文会随步数累积。缓解：readFullResult 的返回内容不需要全部留在 context——agent 读完一条后提取要点，然后读下一条。AI SDK 的 context 管理是自动的，我们只能控制每次返回的数据量。

实际上 readFullResult 返回全文（3000-10000 chars）× 3 条 = 最大 30K chars 每维度。13 维度如果全部累积 = 390K chars ≈ 100K tokens，仍会爆。

**修正方案**: readFullResult 截断到 3000 chars。对于大部分文章，3000 chars 已包含核心段落。如果 Exa 返回 10000 chars 全文，前 3000 chars 通常覆盖了最有价值的内容。

## Risks / Trade-offs

- **[步数大量增加]** 65+ 步 vs 之前 10 步。但每步很轻量（读文件 + LLM 判断），不涉及网络搜索。
- **[上下文累积]** 每步的 tool result 留在 context。3000 chars × 3 reads × 13 dims = 117K chars。缓解：readFullResult 返回 3000 chars 上限。
- **[LLM 成本增加]** 更多步骤 = 更多 LLM 调用。但每步 input 较小（预览/单条全文），token 效率高。
