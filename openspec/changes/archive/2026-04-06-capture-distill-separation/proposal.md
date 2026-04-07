## Why

当前 Capture Agent 同时负责搜索、深度阅读和提取，然后 Distill 又对产出做一遍 classify → cluster → extract，造成重复蒸馏。两个阶段的职责边界不清：

- Capture 做了 readFullResult + extractDimension（本该是 distill 的事）
- Distill 收到的是已提取的 extractions 退化成的 SoulChunk，又从头分类提取一遍
- 结果：两次 LLM 提取，质量反而更低

同时 Planning Agent 只生成维度和 queries，没有为每个维度定义质量评分标准。Capture Agent 凭自己判断"够不够"，不同主题的标准应该不同。

## What Changes

### 1. Planning Agent 增加 qualityCriteria
每个维度增加质量评分标准（文章需要满足什么条件才算合格）和 minArticles（最少合格文章数）。Capture Agent 按此标准筛选。

### 2. Capture Agent 职责收窄为"搜集 + 质量筛选"
- 移除 readFullResult 和 extractDimension 工具
- 保留 evaluateDimension + supplementSearch + reportFindings
- reportFindings 只报 classification + summary，不带 extractions
- 产出：按维度组织的搜索缓存（原始全文）

### 3. Distill 重构为"深度阅读 + 蒸馏"
- 接收维度缓存目录（而非 SoulChunk）
- 按维度并行：读取原始全文 → LLM 深度阅读 → 生成 entry
- 移除 classify/cluster 步骤（capture 已按维度组织）
- 保留 review 去重
- 兼容 markdown/URL 数据源（先 classify 标维度，再同流程）

## Capabilities

### New Capabilities
- `quality-criteria`: Planning Agent 为每个维度生成质量评分标准
- `distill-from-cache`: Distill 直接从维度缓存读取原始全文并生成 entry

### Modified Capabilities
- `planning-agent`: DimensionDef 增加 qualityCriteria 和 minArticles
- `agent-tool-loop`: 移除 readFullResult/extractDimension，简化为质量评估工具集
- `world-capture-agent`: prompt 改为质量评估模式（不再深度阅读）
- `soul-capture-agent`: 同上

## Impact

- 修改 `src/agent/planning/dimension-framework.ts` — DimensionDef 增加 qualityCriteria/minArticles
- 修改 `src/agent/planning/planning-agent.ts` — prompt 要求生成 qualityCriteria
- 删除 `src/agent/tools/read-full-result.ts`
- 删除 `src/agent/tools/extract-dimension.ts`
- 修改 `src/agent/tools/index.ts` — 移除上述两个工具
- 修改 `src/agent/tools/report-findings.ts` — 简化，不再需要 extractionBuffer
- 修改 `src/agent/strategy/soul-capture-strategy.ts` — prompt 改为质量筛选
- 修改 `src/agent/strategy/world-capture-strategy.ts` — 同上
- 修改 `src/agent/capture-agent.ts` — 移除 extractionBuffer 合并逻辑，maxSteps 调回
- 重写 `src/world/distill.ts` — 新增 distillFromCache 方法，按维度并行深度阅读
- 修改 `src/cli/commands/world-create-wizard.tsx` — 传维度缓存目录给 distill，不再中转 SoulChunk
