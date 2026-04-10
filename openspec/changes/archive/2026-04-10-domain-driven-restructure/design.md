## Context

项目 src/ 当前有 14 个顶层目录、141 个 TS/TSX 文件。三个业务领域（soul, world, export）的代码分散在 agent/, distill/, ingest/ 等按机制划分的目录中。command-router-refactor 已解决了 app.tsx 的路由问题，现在做目录层面的领域内聚。

## Goals / Non-Goals

**Goals:**
- 按领域（soul, world, export）组织业务代码，每个领域的 capture → distill → manage 流程代码内聚在同一目录树下
- 将跨领域共用的基础设施收纳到 `infra/`
- cli/commands/ 按领域建子目录
- 拆分 export-agent.ts（2,453 行）为多个模块
- 所有 import 路径一次性更新

**Non-Goals:**
- 不改变任何运行时行为或 API
- 不重构 cli/animation/ 和 cli/components/（纯 UI 组件不按领域分）
- 不改变 export/state/ 的内部结构（它是独立运行时，保持不动）
- 不改变 pack/, engine/, llm/, config/, i18n/, tags/, utils/ 的位置（它们要么已经干净，要么是纯粹的基础设施）

## Decisions

### 1. 目标目录结构

```
src/
├── soul/                           ← Soul 领域
│   ├── capture/                    ← 从 agent/ 迁入
│   │   ├── soul-capture-agent.ts
│   │   ├── soul-capture-strategy.ts
│   │   └── soul-dimensions.ts
│   ├── distill/                    ← 从 distill/ 迁入（整体）
│   │   ├── distill-agent.ts
│   │   ├── sampler.ts
│   │   ├── extractor.ts
│   │   ├── generator.ts
│   │   └── merger.ts
│   ├── batch-pipeline.ts           ← 从 agent/batch-pipeline.ts
│   ├── manifest.ts                 ← 已在此
│   ├── package.ts                  ← 已在此
│   └── snapshot.ts                 ← 已在此
│
├── world/                          ← World 领域（大部分已在此）
│   ├── capture/                    ← 从 agent/ 迁入
│   │   ├── world-capture-agent.ts
│   │   ├── world-capture-strategy.ts
│   │   └── world-dimensions.ts
│   ├── distill.ts                  ← 已在此
│   ├── entry.ts
│   ├── chronicle.ts
│   ├── context-assembler.ts
│   ├── manifest.ts
│   ├── binding.ts
│   ├── resolver.ts
│   └── template.ts
│
├── export/                         ← Export 领域
│   ├── agent/                      ← 从 agent/export-agent.ts 拆分
│   │   ├── types.ts               ← interfaces + event types
│   │   ├── prompts.ts             ← 5 个 buildXxxPrompt 函数
│   │   ├── agent-loop.ts          ← runAgentLoop
│   │   ├── planning.ts            ← runPlanningLoop + validatePlan
│   │   ├── story-setup.ts         ← makeStorySetupTools + runStorySetup
│   │   ├── character.ts           ← makeCharacterTools + runCharacterLoop
│   │   ├── finalize.ts            ← finalizeAndPackage
│   │   └── index.ts               ← runExportAgent 入口
│   ├── skill-template.ts           ← 已在此
│   ├── story-spec.ts
│   ├── packager.ts
│   ├── lint/
│   ├── state/                      ← 不动
│   ├── prose-style/
│   └── format/
│
├── infra/                          ← 跨领域基础设施
│   ├── search/                     ← 从 agent/search/ 迁入
│   │   ├── tavily-search.ts
│   │   ├── searxng-search.ts
│   │   ├── exa-search.ts
│   │   ├── page-extractor.ts
│   │   └── title-filter.ts
│   ├── agent/                      ← 从 agent/ 迁入（通用部分）
│   │   ├── capture-agent.ts
│   │   ├── planning-agent.ts
│   │   ├── dimension-framework.ts
│   │   ├── capture-strategy.ts
│   │   └── tools/
│   │       ├── supplement-search.ts
│   │       ├── evaluate-dimension.ts
│   │       ├── report-findings.ts
│   │       └── index.ts
│   └── ingest/                     ← 从 ingest/ 迁入
│       ├── types.ts
│       ├── pipeline.ts
│       ├── markdown-adapter.ts
│       ├── twitter-adapter.ts
│       ├── url-adapter.ts
│       ├── web-adapter.ts
│       ├── text-adapter.ts
│       ├── synthetic-adapter.ts
│       └── feedback-adapter.ts
│
├── cli/                            ← UI 层
│   ├── app.tsx
│   ├── command-router.ts
│   ├── command-registry.ts
│   ├── command-parser.ts
│   ├── soul-resolver.ts
│   ├── path-resolver.ts
│   ├── commands/
│   │   ├── index.ts               ← 注册表聚合
│   │   ├── soul/                   ← create, use, list, evolve, evolve-status, evolve-rollback, feedback
│   │   ├── world/                  ← world, world-bind, world-create-wizard, world-distill, world-distill-review, world-entry, world-list
│   │   ├── export/                 ← export, pack, unpack
│   │   └── system/                 ← help, config, model, status, recall, source
│   ├── animation/                  ← 不动
│   └── components/                 ← 不动
│
├── pack/                           ← 不动
├── engine/                         ← 不动
├── llm/                            ← 不动
├── config/                         ← 不动
├── i18n/                           ← 不动
├── tags/                           ← 不动
└── utils/                          ← 不动
```

### 2. 文件迁移清单（完整）

**删除的顶层目录：** `agent/`（所有文件迁入 soul/capture, world/capture, export/agent, infra/agent）、`distill/`（迁入 soul/distill）、`ingest/`（迁入 infra/ingest）

**迁移明细：**

| 原路径 | 新路径 | 原因 |
|--------|--------|------|
| agent/soul-capture-agent.ts | soul/capture/soul-capture-agent.ts | 服务 soul |
| agent/strategy/soul-capture-strategy.ts | soul/capture/soul-capture-strategy.ts | 服务 soul |
| agent/strategy/soul-dimensions.ts | soul/capture/soul-dimensions.ts | 服务 soul |
| agent/batch-pipeline.ts | soul/batch-pipeline.ts | 服务 soul 批量创建 |
| agent/world-capture-agent.ts | world/capture/world-capture-agent.ts | 服务 world |
| agent/strategy/world-capture-strategy.ts | world/capture/world-capture-strategy.ts | 服务 world |
| agent/strategy/world-dimensions.ts | world/capture/world-dimensions.ts | 服务 world |
| agent/export-agent.ts | export/agent/*.ts（拆分） | 服务 export |
| agent/capture-agent.ts | infra/agent/capture-agent.ts | 跨领域共用 |
| agent/planning/planning-agent.ts | infra/agent/planning-agent.ts | 跨领域共用 |
| agent/planning/dimension-framework.ts | infra/agent/dimension-framework.ts | 跨领域共用 |
| agent/strategy/capture-strategy.ts | infra/agent/capture-strategy.ts | 跨领域共用 |
| agent/tools/* | infra/agent/tools/* | 跨领域共用 |
| agent/search/* | infra/search/* | 跨领域共用 |
| distill/* | soul/distill/* | 全部服务 soul |
| ingest/* | infra/ingest/* | 跨领域共用 |
| cli/commands/*.tsx | cli/commands/{soul,world,export,system}/*.tsx | 按领域分组 |

### 3. export-agent.ts 拆分方案

按函数边界拆分为 8 个文件：

| 文件 | 内容 | 估计行数 |
|------|------|---------|
| types.ts | interfaces + event types + ExportPlan | ~530 |
| prompts.ts | buildInitialPrompt, buildPlanningPrompt, buildExecutionPrompt, buildStorySetupPrompt, buildCharacterPrompt | ~470 |
| agent-loop.ts | runAgentLoop | ~340 |
| planning.ts | computePlanningStepCap, runPlanningLoop, validatePlan | ~260 |
| story-setup.ts | makeStorySetupTools, runStorySetup | ~300 |
| character.ts | makeCharacterTools, runCharacterLoop | ~180 |
| finalize.ts | finalizeAndPackage | ~65 |
| index.ts | computeExportStepCap, runExportAgent（入口编排） | ~310 |

### 4. Import 路径更新策略

使用脚本化的 sed/grep 批量替换。规则举例：
- `from '../agent/capture-agent.js'` → `from '../infra/agent/capture-agent.js'`
- `from '../distill/generator.js'` → `from '../soul/distill/generator.js'`
- `from '../ingest/types.js'` → `from '../infra/ingest/types.js'`

每个迁移文件自身的内部 import 也需要根据新的相对路径调整。

### 5. cli/commands/index.ts 更新

import 路径从：
```typescript
import { HelpCommand } from './help.js'
```
变为：
```typescript
import { HelpCommand } from './system/help.js'
```

## Risks / Trade-offs

- **[Risk] git blame 历史断裂** → `git log --follow` 可追溯。git mv 会保留 rename detection。
- **[Risk] 大量 import 路径变更可能遗漏** → 用 tsc --noEmit 做编译检查，遗漏会立即报错。
- **[Trade-off] 一次性 vs 渐进式** → 选择一次性。中间状态（一半按领域一半按机制）比当前和目标都差。
- **[Risk] export-agent.ts 拆分可能引入循环依赖** → 拆分严格按依赖方向：types ← prompts ← agent-loop ← planning/story-setup/character ← index。无环。
