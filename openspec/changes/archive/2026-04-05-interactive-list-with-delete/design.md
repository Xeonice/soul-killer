## Context

Soul `/list` 当前是 `ListCommand`——纯 React 组件展示列表，无 `useInput`，无交互。World 的 `/world` 已经改为两层交互菜单（管理→选世界→子操作），但缺少删除。Soul 需要对齐 World 的模式。

## Goals / Non-Goals

**Goals:**
- `/list` 改为交互式列表+子操作菜单
- Soul 和 World 都支持删除操作
- 删除需要二次确认

**Non-Goals:**
- 不改变 Soul 创建流程
- 不改变 World 创建/管理的其他子操作

## Decisions

### Decision 1：Soul ListCommand 重构

```typescript
type ListPhase = 'soul-list' | 'action-menu' | 'action-running' | 'confirm-delete'

// 子操作
type SoulAction = 'show' | 'use' | 'evolve' | 'delete'
```

`/list` 进入 `soul-list`（交互选择），选中后进入 `action-menu`（4个操作），选操作后进入 `action-running`。

### Decision 2：Soul 删除

删除操作流程：
1. 从 action-menu 选择「删除」
2. 进入 `confirm-delete` phase，显示确认提示（世界名+确认/取消）
3. 确认后 `fs.rmSync(soulDir, { recursive: true })`
4. 返回 soul-list（列表刷新）

### Decision 3：World 删除

World 的 ACTION_ITEMS 末尾加 `{ action: 'delete', labelKey: 'world.menu.delete', descKey: 'world.menu.delete_desc' }`。world.tsx 的 action-running 渲染确认提示，确认后调用 `deleteWorld(worldName)`，返回 world-list。

### Decision 4：ListCommand Props

```typescript
interface ListCommandProps {
  onUse: (soulName: string, soulDir: string) => void  // 加载 soul
  onClose: () => void
}
```

`onUse` 回调让 app.tsx 处理 soul 加载逻辑（设 soulName/soulDir/promptMode）。

## Risks / Trade-offs

**[Risk] 删除不可恢复** → 二次确认 + 显示将删除的内容（entry 数/chunk 数）减轻误操作风险。
