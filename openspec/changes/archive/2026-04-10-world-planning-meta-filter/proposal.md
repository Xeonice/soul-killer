## Why

World capture 对"现实背景"作品（如 White Album 2、灌篮高手）的搜索结果充斥着作品制作/发行/改编的 meta 信息（声优阵容、动画播出日期、游戏移植版本等），而不是故事世界内部的事实（地点、人物关系、事件时间线）。根本原因是 Planning Agent 的 prompt 中没有"世界内信息 vs 作品 meta 信息"的区分指导，也没有基于 `classification` 字段（`FICTIONAL_UNIVERSE` / `REAL_SETTING`）给出差异化的搜索策略。

下游的 distill 层虽然有 "IN-WORLD ONLY" 的 prompt 指令，但当 90% 的输入文章都是 meta 内容时，LLM 难以抵抗上下文压力，仍然会输出 meta 条目。在搜索规划层（最上游）修复效果最好——让正确的信息进入 pipeline，而不是在下游试图从垃圾中筛出黄金。

## What Changes

- 在 `buildPlanningPrompt()` 中增加"世界内信息优先"的明确定义，指导 Planning Agent 生成指向故事世界内部事实的 query，排斥作品制作/发行/改编类 query
- 基于 `classification` 字段引入条件策略：`REAL_SETTING` 类世界的 query 必须带限定词（"故事内"/"设定"/"in-story"/"in-universe"），qualityCriteria 必须包含 meta 排斥条件
- 在 `WORLD_DIMENSION_TEMPLATES` 的 qualityCriteria 模板中增加默认的 meta 排斥条目

## Capabilities

### New Capabilities
- `world-planning-meta-exclusion`: Planning Agent 在世界搜索规划阶段识别并排斥作品 meta 信息，基于世界类型（幻想/现实背景）采用差异化搜索策略

### Modified Capabilities
- `planning-agent`: Planning Agent prompt 增加世界内信息定义和 classification 条件分支

## Impact

- `src/agent/planning/planning-agent.ts` — `buildPlanningPrompt()` prompt 文本重写（世界类型分支 + meta 排斥指令）
- `src/agent/strategy/world-dimensions.ts` — `WORLD_DIMENSION_TEMPLATES` 的 qualityCriteria 补充 meta 排斥条目
- 不影响 soul capture 流程（soul 不存在这个问题）
- 不影响 distill 层（distill 的 IN-WORLD ONLY 指令保留作为安全网）
