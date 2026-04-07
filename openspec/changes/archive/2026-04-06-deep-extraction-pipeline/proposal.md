## Why

三国 World 创建的实测产物中 67% 是 1 句话的浅层碎片。根因追踪发现问题贯穿四层：

1. **Agent extraction 太浅** — 每条 extraction 只有 1 句话（如"200年官渡之战，曹操偷袭乌巢，大败袁绍"），agent 几乎不使用 extractPage 获取全文
2. **Cluster 退化为 1:1** — 34 条短 extraction 生成 31 个 cluster，大部分 cluster 只有 1 个 chunk
3. **Distill prompt 压缩而非扩展** — prompt 要求 "concise"，1 句话输入 → 1 句话输出
4. **无合并/审查机制** — 同维度的重复碎片各自成为独立 entry

搜索 query 质量已在 search-query-decomposition 中优化，本次改造聚焦于**从搜索结果到最终 entry 的深度转化链路**。

## What Changes

- 重写 agent system prompt 的 extraction 策略：从"一条一事实"改为"一条一段落"，每条 200-500 字，每维度 3-5 条
- 在 agent prompt 中强制要求对高质量搜索结果使用 extractPage 获取全文后再摘录
- 重写 world distill 的 extract 阶段：从 per-cluster 生成改为 per-dimension merge-then-expand，每维度输出 2-5 个深度 entry
- 将 extract prompt 从 "concise" 改为要求 5-10 句详细描述，解释因果和机制
- 增加 review 阶段：LLM 审查所有 entry，合并重复、标记浅层条目

## Capabilities

### New Capabilities
- `deep-extraction-strategy`: Agent extraction 的深度策略，包括段落级提取规则和 extractPage 强制使用规则
- `world-distill-review`: World distill 的 review 阶段，合并重复 entry、标记浅层条目

### Modified Capabilities
- `world-capture-agent`: system prompt 的 extraction guidelines 改为深度提取
- `soul-capture-agent`: system prompt 的 extraction guidelines 同步改为深度提取（保持一致性）

## Impact

- `src/agent/soul-capture-strategy.ts` — extraction guidelines 重写
- `src/agent/world-capture-strategy.ts` — extraction guidelines 重写
- `src/world/distill.ts` — extract 阶段重构 + 新增 review 阶段
- 现有测试中与 extraction 数量/格式相关的断言需要更新
