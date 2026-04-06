## Why

Soul 的 `/evolve` 和 World 的「蒸馏」操作都是"给已有实体补充新数据"，但实现路径完全不同于创建流程：Soul evolve 自己实现了一套独立 pipeline（单数据源→维度选择→extract→merge），没有 AI 搜索能力；World 蒸馏只是简单收集 markdown 路径→蒸馏。两者都缺少创建流程的完整数据管线（AI Agent 搜索+多数据源组合+可视化面板）。

应该统一为：**进化 = 创建的补充模式**——复用创建向导的完整流程（数据源选择→AI搜索→蒸馏面板→审查），但跳过基本信息收集，将新数据整合进已有实体。

## What Changes

- **WorldCreateWizard 增加 `supplementWorld` prop**：外部传入世界名时直接进入补充模式（跳过 type-select/name/display-name/description/tags/confirm，直接到 data-sources），不再只能通过 name-conflict 触发
- **World 子操作菜单的「蒸馏」改为渲染 WorldCreateWizard(supplementWorld=worldName)**：复用完整创建管线
- **Soul CreateCommand 增加 `supplementSoul` prop**：传入 soulName+soulDir 时加载已有 manifest，跳过 type-select/name/description/tags/confirm，直接到 data-sources→AI搜索→蒸馏
- **Soul `/evolve` 命令改为渲染 CreateCommand(supplementSoul)**：替换独立的 EvolveCommand
- **Soul CreateCommand 补充模式的蒸馏阶段增加 merge 逻辑**：新 distill 结果与现有 soul files 合并（复用现有 merger.ts），写入前创建 snapshot
- **删除独立的 WorldDistillCommand**（被 wizard 补充模式取代）
- **保留 EvolveCommand 的 rollback/status 子命令**（这些不受影响）

## Capabilities

### New Capabilities
（无）

### Modified Capabilities
- `world-create-wizard`: 新增 `supplementWorld` prop，外部直接进入补充模式
- `world-commands`: 蒸馏操作渲染 WorldCreateWizard(supplementWorld) 而非 WorldDistillCommand
- `create-command`: 新增 `supplementSoul` prop，外部直接进入补充模式；补充模式蒸馏阶段增加 merge + snapshot
- `evolve-command`: `/evolve` 改为渲染 CreateCommand(supplementSoul)，去掉独立 pipeline

## Impact

- **修改** `src/cli/commands/world-create-wizard.tsx`（supplementWorld prop）
- **修改** `src/cli/commands/world.tsx`（蒸馏渲染 wizard 补充模式）
- **修改** `src/cli/commands/create.tsx`（supplementSoul prop + merge 逻辑）
- **修改** `src/cli/app.tsx`（/evolve 改为渲染 CreateCommand 补充模式）
- **废弃** `src/cli/commands/world-distill.tsx` 中的 WorldDistillCommand（保留 WorldEvolveCommand 暂不删除，后续清理）
