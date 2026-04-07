## Why

当前的 planSearch tool 是纯模板填充器(0ms, 零LLM调用)，对所有目标返回固定的 9(world)/8(soul) 个维度，只替换名字。这导致维度无法适配具体场景:

- 三国缺少"军事战略"、"外交博弈"等关键维度，factions 太粗无法体现魏蜀吴各自特征
- Cyberpunk 2077 的 species 维度应该是"义体改造/AI分类"，而非种族
- 诸葛亮的 Soul 缺少"政治遗产"、"文学作品"等扩展维��

固定维度在 4 处硬编码: planSearch 返回、checkCoverage 信号、reportFindings enum、distill classify，导致整条链路都被锁死。

## What Changes

- 新增 Planning Agent: 独立 LLM 调用，在 capture agent 之前运行，基于 pre-search 侦察结果动态生成维度计划
- 统一 Soul/World 的维度框架: 共享 `DimensionDef` / `DimensionPlan` 接口，区别仅在基础维度不同
- 基础维度(不可删除) + 扩展维度(0-6个, 动态生成)，总数上限 15
- 维度计划持久化到 manifest，供 capture agent 和 distill 两阶段使用
- Planning Agent 失败时阻断流程，要求用户重试(非 fallback)
- 扩展维度的 coverage signals 由 Planning Agent 生成 keywords，运行时转为正则

## Capabilities

### New Capabilities
- `planning-agent`: 独立的维度规划 agent，输入 pre-search 结果+基础维度，输出定制维度计划(DimensionPlan)
- `dimension-framework`: Soul/World 统一的维度��义接口(DimensionDef/DimensionPlan)，支持基础维度+扩展维度

### Modified Capabilities
- `search-planning`: planSearch 从模板填充改为读取 Planning Agent 生成的维度计划
- `coverage-check`: checkCoverage 从硬编码信号改为从��度计划读取 signals
- `world-capture-agent`: system prompt 的维度描述从硬编码改为注入 DimensionPlan
- `soul-capture-agent`: 同上

## Impact

- 新增 `src/agent/planning-agent.ts` -- Planning Agent 实现
- 新增 `src/agent/dimension-framework.ts` -- 统一的 DimensionDef/DimensionPlan 接口及基础维度定义
- 重构 `src/agent/soul-dimensions.ts` -- 迁移到统一框架，保留基础维度定义
- 重构 `src/agent/world-dimensions.ts` -- 同上
- 修改 `src/agent/capture-agent.ts` -- 在 agent loop 前调用 Planning Agent
- 修改 `src/agent/tools/search-factory.ts` -- planSearch/checkCoverage/reportFindings 从 DimensionPlan 动态构建
- 修改 `src/agent/soul-capture-strategy.ts` -- system prompt 注入动态维度描述
- 修改 `src/agent/world-capture-strategy.ts` -- 同上
- 修改 `src/world/distill.ts` -- classify 从 manifest 读取维度列表
- 修改 `src/world/manifest.ts` -- manifest 增加 dimensions 字段
- 修改 `src/soul/manifest.ts` -- 同上(如有)
