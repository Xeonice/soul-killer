## Context

当前 `world.tsx` 的 `WorldCommand` 组件有 8 个顶层菜单项，其中 6 个需要先选世界再操作。用户每次做不同操作都要重新选世界。`WorldListCommand` 是纯展示组件，无法交互选择。蒸馏/进化操作缺少可视化面板，进化的冲突解决只有 TODO 注释。

## Goals / Non-Goals

**Goals:**
- `/world` 菜单改为两层：创建 + 管理（列表选世界→子操作）
- 世界列表可交互选择
- 子操作菜单中蒸馏使用 WorldDistillPanel
- 补充 E2E 测试覆盖管理操作

**Non-Goals:**
- 不改变子命令组件的内部逻辑（WorldEntryCommand/WorldBindCommand 等）
- 不改变 WorldCreateWizard
- 不改变 world distill/evolve 的核心蒸馏逻辑

## Decisions

### Decision 1：两层菜单结构

```
/world 顶层菜单：
  ❯ 创建    创建一个新世界
    管理    选择已有世界进行操作

选「管理」→ 世界选择列表：
  ❯ night-city     Night City (5 entries)
    middle-earth   中土世界 (12 entries)
  ESC 返回

选中世界 → 子操作菜单：
  night-city — Night City
  ❯ 详情    查看详情和条目
    条目    添加条目
    蒸馏    从数据源提取条目
    进化    增量更新
    绑定    绑定到当前 Soul
    解绑    解绑
  ESC 返回世界列表
```

**ESC 导航**：子操作 ESC → 返回世界列表，世界列表 ESC → 返回顶层菜单，顶层菜单 ESC → 退出 /world。

### Decision 2：WorldCommand 状态重构

```typescript
type WorldPhase =
  | 'top-menu'          // 顶层：创建 / 管理
  | 'world-list'        // 世界选择列表
  | 'action-menu'       // 子操作菜单（已选中世界）
  | 'action-running'    // 子操作执行中
```

不再使用 `collect-world-select` 中间步骤。世界选择直接作为 `world-list` phase 的一部分。

### Decision 3：蒸馏/进化操作的路径收集

选了「蒸馏」或「进化」后，需要在子操作菜单内收集 source path。这可以作为 `action-running` phase 的一部分——子命令组件内部处理路径输入。

**方案**：给 WorldDistillCommand 和 WorldEvolveCommand 增加可选的 `sourcePath` prop。如果未提供，组件内部展示 TextInput 收集路径。这样菜单层不需要处理路径收集。

### Decision 4：E2E 测试策略

新增一个 E2E 测试文件 `tests/e2e/world-manage-e2e.ts`，覆盖：
1. `/world` → 管理 → 列表展示已有世界
2. 选中世界 → 详情 → 展示正确
3. 选中世界 → 条目 → 添加成功
4. 选中世界 → 蒸馏（需要 markdown 数据源）
5. 选中世界 → 绑定（需要先 /use 加载 soul）

前置条件：先用 `/world` → 创建 创建一个测试世界（可用 fictional-original + 空数据源快速创建）。

## Risks / Trade-offs

**[Risk] 空列表状态** → 当没有世界时，「管理」选项应该禁用或进入后显示空状态提示。

**[Trade-off] 蒸馏路径收集放在子命令内部** → 增加了子命令的复杂度，但避免了菜单层处理多种收集步骤。
