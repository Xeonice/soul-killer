## 1. 创建目录结构

- [x] 1.1 创建新目录：soul/capture/, world/capture/, export/agent/, infra/search/, infra/agent/tools/, infra/ingest/, cli/commands/soul/, cli/commands/world/, cli/commands/export/, cli/commands/system/

## 2. Soul 领域迁移

- [x] 2.1 迁移 agent/soul-capture-agent.ts → soul/capture/soul-capture-agent.ts
- [x] 2.2 迁移 agent/strategy/soul-capture-strategy.ts → soul/capture/soul-capture-strategy.ts
- [x] 2.3 迁移 agent/strategy/soul-dimensions.ts → soul/capture/soul-dimensions.ts
- [x] 2.4 迁移 agent/batch-pipeline.ts → soul/batch-pipeline.ts
- [x] 2.5 迁移 distill/ 全部 5 个文件 → soul/distill/（distill-agent, sampler, extractor, generator, merger）

## 3. World 领域迁移

- [x] 3.1 迁移 agent/world-capture-agent.ts → world/capture/world-capture-agent.ts
- [x] 3.2 迁移 agent/strategy/world-capture-strategy.ts → world/capture/world-capture-strategy.ts
- [x] 3.3 迁移 agent/strategy/world-dimensions.ts → world/capture/world-dimensions.ts

## 4. Export 领域：拆分 export-agent.ts

- [x] 4.1 创建 export/agent/types.ts — 提取 interfaces + event types + ExportPlan
- [x] 4.2 创建 export/agent/prompts.ts — 提取 5 个 buildXxxPrompt 函数
- [x] 4.3 创建 export/agent/agent-loop.ts — 提取 runAgentLoop
- [x] 4.4 创建 export/agent/planning.ts — 提取 runPlanningLoop + validatePlan + computePlanningStepCap
- [x] 4.5 创建 export/agent/story-setup.ts — 提取 makeStorySetupTools + runStorySetup
- [x] 4.6 创建 export/agent/character.ts — 提取 makeCharacterTools + runCharacterLoop
- [x] 4.7 创建 export/agent/finalize.ts — 提取 finalizeAndPackage
- [x] 4.8 创建 export/agent/index.ts — runExportAgent 入口 + computeExportStepCap re-export
- [x] 4.9 删除原 agent/export-agent.ts

## 5. Infra 迁移

- [x] 5.1 迁移 agent/capture-agent.ts → infra/agent/capture-agent.ts
- [x] 5.2 迁移 agent/planning/planning-agent.ts → infra/agent/planning-agent.ts
- [x] 5.3 迁移 agent/planning/dimension-framework.ts → infra/agent/dimension-framework.ts
- [x] 5.4 迁移 agent/strategy/capture-strategy.ts → infra/agent/capture-strategy.ts
- [x] 5.5 迁移 agent/tools/* → infra/agent/tools/*
- [x] 5.6 迁移 agent/search/* → infra/search/*
- [x] 5.7 迁移 ingest/* → infra/ingest/*

## 6. CLI commands 按领域分组

- [x] 6.1 迁移 create, use, list, evolve, evolve-status, evolve-rollback, feedback → cli/commands/soul/
- [x] 6.2 迁移 world, world-bind, world-create-wizard, world-distill, world-distill-review, world-entry, world-list → cli/commands/world/
- [x] 6.3 迁移 export, pack, unpack → cli/commands/export/
- [x] 6.4 迁移 help, config, model, status, recall, source → cli/commands/system/

## 7. Import 路径批量更新

- [x] 7.1 更新所有从 agent/ import 的路径（→ soul/capture, world/capture, export/agent, infra/agent, infra/search）
- [x] 7.2 更新所有从 distill/ import 的路径（→ soul/distill）
- [x] 7.3 更新所有从 ingest/ import 的路径（→ infra/ingest）
- [x] 7.4 更新 cli/commands/index.ts 的 import 路径（→ soul/, world/, export/, system/ 子目录）
- [x] 7.5 更新 tests/ 中引用迁移文件的 import 路径

## 8. 清理与验证

- [x] 8.1 删除空的旧目录：agent/, distill/, ingest/
- [x] 8.2 运行 `bun run build` 确认类型检查通过
- [x] 8.3 运行 `bun run test` 确认单元测试通过（909/909）
- [x] 8.4 运行 `bun run test:e2e` 确认 E2E 测试行为不变（10/12 pass，Scenario 4+10 为已有问题）
