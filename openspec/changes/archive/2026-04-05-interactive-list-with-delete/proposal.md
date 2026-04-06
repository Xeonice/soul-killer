## Why

Soul 的 `/list` 是纯展示列表，无法交互选择或操作。`/use`、`/evolve` 等操作需要用户记住 soul 名称手动输入。同时 Soul 和 World 都缺少删除操作。应将 `/list` 改为交互式列表+子操作菜单（与 World 的 `/world` 管理模式对齐），并给 Soul 和 World 都加上删除操作。

## What Changes

- **Soul `/list` 改为交互式**：从纯展示改为方向键选择 + Enter 进入子操作菜单（详情/加载/进化/删除）
- **Soul 子操作：详情**：展示 manifest 信息 + soul files 概览
- **Soul 子操作：加载**：等同于 `/use <name>`
- **Soul 子操作：进化**：渲染 CreateCommand 补充模式
- **Soul 子操作：删除**：确认后删除 soul 目录
- **World 子操作菜单新增「删除」**：确认后调用 deleteWorld()
- **app.tsx `/list` 改为 interactiveMode**

## Capabilities

### New Capabilities
（无）

### Modified Capabilities
- `repl-shell`: `/list` 从 commandOutput 改为 interactiveMode
- `world-commands`: 子操作菜单新增「删除」选项

## Impact

- **重写** `src/cli/commands/list.tsx`（纯展示→交互列表+子操作）
- **修改** `src/cli/app.tsx`（`/list` 设 interactiveMode）
- **修改** `src/cli/commands/world.tsx`（ACTION_ITEMS 加删除）
- **新增** i18n key（Soul 子操作菜单文案、删除确认、World 删除）
