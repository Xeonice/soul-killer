## Context

当前架构:
- Soul 有 8 个硬编码维度 (`soul-dimensions.ts`)，World 有 9 个 (`world-dimensions.ts`)
- 两套独立的类型、模板、coverage 分析、搜索计划生成
- `planSearch` tool 是纯函数(正则解析 + 模板替换)，0ms 执行，无 LLM 调用
- `ToolLoopAgent` 的 tool schema 在启动前确定，运行中无法修改 dimension enum
- 维度在 4 处硬编码: planSearch、checkCoverage、reportFindings enum、distill classify

关键约束: 因为 tool schema 在 agent 启动前就需要确定，Planning Agent 必须是独立调用，不能融入 capture agent 内部。

## Goals / Non-Goals

**Goals:**
- Soul/World 共享统一的维度框架接口
- Planning Agent 基于侦察结果动态生成扩展维度
- 基础维度保底(不可删除)，扩展维度增强(0-6 个)
- 维度计划持久化，capture 和 distill 两阶段共用
- Planning Agent 失败时阻断流程，不做 fallback

**Non-Goals:**
- 不改变 capture agent 的 ToolLoopAgent 架构
- 不改变搜索引擎后端
- 不改变 entry 的存储格式(frontmatter + markdown)
- 不引入用户交互确认维度(当前全自动)

## Decisions

### Decision 1: 统一维度框架 -- DimensionDef / DimensionPlan

**选择**: 新增 `src/agent/dimension-framework.ts`，定义共享接口:

```typescript
interface DimensionDef {
  name: string            // kebab-case: "geography", "military-strategy"
  display: string         // 人类可读: "地理", "军事战略"
  description: string     // 给 LLM 看的维度描述
  priority: 'required' | 'important' | 'supplementary'
  source: 'base' | 'extension'
  signals: string[]       // coverage 检测关键词，运行时转 RegExp
  queries: string[]       // 搜索模板/定制 queries
  distillTarget: string   // 'background' | 'rule' | 'lore' | 'atmosphere'
}

interface DimensionPlan {
  classification: string
  englishName: string
  localName: string
  origin: string
  dimensions: DimensionDef[]  // base + extension, 已排序
}
```

`SOUL_BASE_DIMENSIONS` 和 `WORLD_BASE_DIMENSIONS` 作为常量定义在各自文件中，但遵循统一的 `DimensionDef` 接口。

**Why**: 统一接口让 Planning Agent、capture agent、distill 三个阶段用同一个数据结构传递维度信息，消除类型不一致。

### Decision 2: Planning Agent 是独立 LLM 调用

**选择**: 新增 `src/agent/planning-agent.ts`，导出 `runPlanningAgent()` 函数:

```typescript
async function runPlanningAgent(
  client: OpenAI,
  model: string,
  type: 'soul' | 'world',
  name: string,
  hint: string | undefined,
  preSearchResults: SearchResult[],
  classification: string,
): Promise<DimensionPlan>
```

执行流程:
1. 从 type 获取对应的基础维度列表
2. 构造 planning prompt，包含: 基础维度定义、pre-search 结果摘要、目标名称/hint
3. 单次 LLM 调用，要求返回 JSON
4. 解析 JSON: 提取基础维度调整(priority/description 变更) + 扩展维度列表
5. 校验: 基础维度未被删除、扩展维度 <= 6、总数 <= 15
6. 解析失败或校验失败 → 抛出错误(调用方捕获后要求用户重试)

**Planning Prompt 核心结构**:
```
你是一个研究规划师。基于侦察信息，为目标"[name]"定制维度计划。

基础维度(不可删除):
[列出所有基础维度的 name/description/priority]

你可以:
1. 调整基础维度的 priority 和 description(使其更贴合具体目标)
2. 新增 0-6 个扩展维度

每个扩展维度需要:
- name: kebab-case 英文标识
- display: 人类可读名称
- description: 维度描述(给搜索 agent 看)
- priority: required/important/supplementary
- signals: 5-10 个检测关键词(中英文混合)
- queries: 2-4 条搜索 query

侦察信息:
[pre-search results 摘要]

输出 JSON:
{
  "adjustments": [
    {"name": "factions", "priority": "required", "description": "...更贴切的描述..."}
  ],
  "extensions": [
    {"name": "military-strategy", "display": "军事战略", ...}
  ]
}
```

**Why**: 独立调用确保维度在 capture agent 启动前确定，解决 tool schema 的编译时约束问题。单次调用 token 开销约 3000-4000，耗时约 2-5 秒，可接受。

### Decision 3: 在 capture-agent.ts 中集成 Planning Agent

**选择**: 修改 `runCaptureAgent()` 的执行流:

```
Pre-search
    ↓
Planning Agent → DimensionPlan       ← 新增
    ↓
(DimensionPlan 写入 manifest)        ← 新增
    ↓
createAgentTools(config, { ..., dimensionPlan })  ← 改造
    ↓
ToolLoopAgent.stream()               ← 不变
```

具体改动:
- `createAgentTools()` 新增 `dimensionPlan` 参数
- `planSearch` execute: 直接返回 dimensionPlan 的 queries，不再模板替换
- `checkCoverage`: 用 dimensionPlan 的 signals 转 RegExp 做检测
- `reportFindings`: dimension enum 从 `dimensionPlan.dimensions.map(d => d.name)` 构建
- `CaptureStrategy.systemPrompt` 改为方法 `buildSystemPrompt(dimensionPlan)`，注入维度描述

**Planning Agent 失败处理**:
`runPlanningAgent()` 抛出 Error，`runCaptureAgent()` 不 catch，让错误冒泡到 UI 层。UI 显示错误信息并提示用户重试。

### Decision 4: 维度计划持久化到 manifest

**选择**: World manifest (`world.json`) 和 Soul manifest 增加 `dimensions` 字段:

```json
{
  "name": "三国",
  "dimensions": [
    {"name": "geography", "source": "base", "priority": "required", ...},
    {"name": "military-strategy", "source": "extension", "priority": "important", ...}
  ]
}
```

Distill 阶段从 manifest 读取维度列表用于 classify。

Evolve 操作(追加数据) 不重新触发 Planning Agent，沿用已有维度。

### Decision 5: Extension 维度的 signals -- 关键词转正则

**选择**: Planning Agent 生成 `signals: string[]`(如 `["战役", "战术", "兵法", "battle", "military"]`)。运行时转为 RegExp:

```typescript
function signalsToRegex(signals: string[]): RegExp[] {
  // 中文关键词: 直接匹配
  const cjk = signals.filter(s => /[\u4e00-\u9fff]/.test(s))
  // 英文关键词: word boundary
  const en = signals.filter(s => !/[\u4e00-\u9fff]/.test(s))
  
  const patterns: RegExp[] = []
  if (cjk.length) patterns.push(new RegExp(cjk.join('|')))
  if (en.length) patterns.push(new RegExp(`\\b(?:${en.join('|')})\\b`, 'i'))
  return patterns
}
```

基础维度保留现有的手写 signals 正则(更精准)，扩展维度用 Planning Agent 生成的 keywords 转正则。

## Risks / Trade-offs

- **[Planning Agent 增加延迟]** 单次 LLM 调用约 2-5 秒。缓解: 只在首次创建时触发，evolve 不触发。
- **[LLM 生成的扩展维度质量不稳定]** 可能生成无意义或过于细碎的维度。缓解: 校验约束(0-6 个扩展, 总数 <= 15)，且基础维度保底。
- **[Planning Agent JSON 解析失败]** LLM 可能返回非法 JSON。处理: 抛出错误，UI 层提示用户重试。不做 fallback。
- **[大范围重构]** 涉及 10+ 文件改动。缓解: 分步实现，先建框架再迁移。统一接口后代码量实际会减少(两套维度代码合一)。
- **[向后兼容]** 已有的 world/soul 没有 dimensions 字段。缓解: 读取 manifest 时如果没有 dimensions 字段，用对应类型的基础维度作为默认值。
