## Context

当前两套独立的进化实现：

```
Soul evolve（EvolveCommand）:
  source-select(单选) → path-input → dimension-select
  → pipeline: ingest → engine → snapshot → sample → extract → merge → write → history
  缺少：AI搜索、多数据源组合、搜索面板

World 蒸馏（WorldDistillCommand）:
  collect-path → distill(markdown only) → review → write
  缺少：AI搜索、多数据源组合、蒸馏面板
```

已有的创建向导都支持完整管线（AI搜索+多数据源+可视化面板）。补充模式的雏形已存在于 WorldCreateWizard 的 name-conflict 处理中。

## Goals / Non-Goals

**Goals:**
- World 蒸馏 = WorldCreateWizard 补充模式（完整管线）
- Soul 进化 = CreateCommand 补充模式（完整管线 + merge）
- 两者共享"进化 = 创建的补充模式"的统一模式

**Non-Goals:**
- 不改变 Soul 创建的正常流程
- 不改变 World 创建的正常流程
- 不删除 evolve-status / evolve-rollback（这些独立功能保留）
- 不改变 Soul 的 merge/snapshot 核心逻辑（只在 CreateCommand 补充模式中调用）

## Decisions

### Decision 1：WorldCreateWizard supplementWorld prop

```typescript
interface WorldCreateWizardProps {
  soulDir?: string
  supplementWorld?: string  // 传入时直接进入补充模式
  onComplete: () => void
  onCancel: () => void
}
```

传入 `supplementWorld` 时：
- 加载已有 manifest（worldType/tags/description）
- 设 `supplementMode = true`
- 初始 step 直接跳到 `data-sources`（跳过 type-select → name → display-name → description → tags → confirm）
- 后续流程不变（data-sources → AI搜索 → 蒸馏面板 → review → 追加 entries）

### Decision 2：Soul CreateCommand supplementSoul prop

```typescript
interface CreateCommandProps {
  onComplete: (soulName: string, soulDir: string) => void
  onCancel: () => void
  supplementSoul?: { name: string; dir: string }  // 传入时进入补充模式
}
```

传入 `supplementSoul` 时：
- 加载已有 manifest（soulType/tags/description）
- 初始 step 直接跳到 `data-sources`（跳过 type-select → name → description → tags → confirm → name-conflict）
- AI 搜索使用已有 soulName 搜索新数据
- 蒸馏后增加 merge 步骤：
  1. `createSnapshot(soulDir)` 保存当前状态
  2. `extractFeatures()` 从新 chunks 提取 delta features
  3. `mergeSoulFiles()` 合并 delta 与现有 soul files
  4. `generateSoulFiles()` 写入合并结果
  5. `appendEvolveEntry()` 记录进化历史
- 这些步骤复用现有 `distill/merger.ts` 和 `soul/snapshot.ts`

### Decision 3：/evolve 命令路由

```
/evolve           → CreateCommand(supplementSoul={name, dir})
/evolve status    → EvolveStatusCommand（保留）
/evolve rollback  → EvolveRollbackCommand（保留）
```

`/evolve` 不带参数时进入补充模式创建向导。带 status/rollback 子命令时走原有逻辑。

### Decision 4：World 蒸馏路由

```
/world → 管理 → 选世界 → 蒸馏 → WorldCreateWizard(supplementWorld=worldName)
```

## Risks / Trade-offs

**[Risk] Soul 补充模式的蒸馏比当前 evolve 更重** → 当前 evolve 支持 text/feedback 等轻量输入，补充模式走完整管线可能过重。可以在 data-sources 步骤增加 text/feedback 选项。

**[Trade-off] EvolveCommand 不立即删除** → 保留为 legacy，避免一次性改动太大。后续确认补充模式稳定后再清理。
