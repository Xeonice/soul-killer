## Why

确定性搜索收集了 300+ 条全文结果，但 evaluateDimension 只返回每维度 5 条 × 500 chars 预览。Agent 基于这些预览提取 extractions，每维度只产出 1 条——信息利用率极低。

磁盘缓存有完整数据，但 agent 工作流没有"深度阅读"环节。evaluate 完就直接 reportFindings 了，跳过了最关键的全文阅读和多条提取步骤。

## What Changes

- Agent 工作流从"评估 → 报告"改为"评估 → 深度阅读 → 按维度提取 → 报告"
- 新增 readFullResult 工具：按 index 读取缓存中某条结果的全文
- 新增 extractDimension 工具：按维度提交 3-5 条 extractions（不等到最终 reportFindings 才一次性提）
- reportFindings 变为最终汇总：把各维度已提取的 extractions 合并提交

## Capabilities

### New Capabilities
- `deep-read-workflow`: Agent 按维度深读全文并提取 extractions 的工作流

### Modified Capabilities
- `agent-tool-loop`: 新增 readFullResult + extractDimension 工具
- `soul-capture-agent`: prompt 增加深度阅读指令
- `world-capture-agent`: 同上

## Impact

- 修改 `src/agent/tools/search-factory.ts` — 新增 readFullResult、extractDimension 工具
- 修改 `src/agent/soul-capture-strategy.ts` — prompt 增加深度阅读工作流
- 修改 `src/agent/world-capture-strategy.ts` — 同上
- 修改 `src/agent/capture-agent.ts` — maxSteps 调整，收集各维度 extractions
