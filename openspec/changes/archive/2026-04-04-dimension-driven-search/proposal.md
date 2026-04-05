## Why

agent-loop-refactor 将搜索从固定管线改为 LLM 自主驱动后，信息收集量明显下降。LLM 搜到身份信息就 report，缺少台词、性格分析、行为模式等构建灵魂所必需的维度数据。根本原因是 agent 没有「一个灵魂需要哪些信息」的认知框架，也没有系统性的覆盖度检查。

## What Changes

- 定义灵魂信息的 6 个维度模型：identity（身份）、quotes（语料）、expression（表达风格）、thoughts（思想观点）、behavior（行为模式）、relations（人际关系）
- 新增 `planSearch` tool：根据侦察结果的分类，按「维度 × 信息源」矩阵生成搜索计划，包含每个维度的推荐查询和目标信息源
- 新增 `checkCoverage` tool：分析已收集 extractions 的维度覆盖情况，返回各维度命中数和缺失提示
- 改造 agent 流程为三阶段：侦察（确定身份）→ 规划（生成搜索计划）→ 采集（按维度搜索 + 覆盖检查）
- 用 `prepareStep` 控制阶段切换：前 2 步隐藏 planSearch/checkCoverage/reportFindings，规划完成后才解锁全部工具
- reportFindings 的 extractions 新增 dimension 字段标注每条数据属于哪个维度
- 覆盖度最低要求：6 个维度至少覆盖 3 个，且必需维度（identity、quotes、expression）中至少覆盖 2 个

## Capabilities

### New Capabilities

- `soul-dimensions`: 灵魂信息维度模型定义，包含 6 维度的分类、优先级、按目标类型的信息源映射
- `search-planning`: planSearch tool 实现，按分类×维度生成搜索计划（推荐查询 + 信息源策略）
- `coverage-check`: checkCoverage tool 实现，分析 extractions 的维度覆盖度，返回覆盖报告

### Modified Capabilities

- `agent-tool-loop`: 新增 planSearch/checkCoverage 两个 tool；用 prepareStep 实现三阶段流程控制；更新 system prompt 加入维度框架；reportFindings extractions 新增 dimension 字段

## Impact

- `src/agent/tools/search-factory.ts` — 新增 planSearch、checkCoverage tool 定义
- `src/agent/soul-capture-agent.ts` — 更新 system prompt、prepareStep 阶段控制逻辑
- 新增 `src/agent/dimensions.ts` — 维度模型定义、分类×维度的信息源映射表、覆盖度分析逻辑
- `src/ingest/web-adapter.ts` — WebSearchExtraction 可能需要新增 dimension 字段
- 测试：新增维度覆盖分析的单元测试
