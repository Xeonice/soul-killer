## Why

当前 `/world` 菜单有 8 个平铺项，其中详情/条目/蒸馏/进化/绑定/解绑都需要先选一个世界，但每个操作独立弹出世界选择列表，体验割裂。应改为两层导航：先选世界，再选操作。同时多个操作（详情、蒸馏、进化等）在 E2E 测试中验证为不可用或交互有问题，需要修复并补充 E2E 测试覆盖。

## What Changes

- **重构 `/world` 菜单为两层结构**：顶层只有「创建」和「管理」两项。「管理」进入世界列表（可交互选择），选中世界后弹出子操作菜单（详情/条目/蒸馏/进化/绑定/解绑）
- **WorldListCommand 改为可交互选择**：从纯展示改为方向键选择 + Enter 确认，选中后进入子操作菜单
- **修复蒸馏/进化操作**：蒸馏操作增加蒸馏面板（复用 WorldDistillPanel），进化操作补全冲突解决交互
- **补充 E2E 测试**：覆盖世界管理的完整操作链路（列表→选世界→详情、条目、蒸馏、绑定/解绑）

## Capabilities

### New Capabilities
（无新 capability）

### Modified Capabilities
- `world-commands`: `/world` 菜单从 8 项平铺改为两层导航（创建 + 管理→世界列表→子操作菜单）
- `e2e-scenarios`: 新增世界管理操作的 E2E 测试场景

## Impact

- **重写** `src/cli/commands/world.tsx`（菜单结构从平铺改为两层）
- **修改** `src/cli/commands/world-list.tsx`（WorldListCommand 增加交互选择能力）
- **修改** `src/cli/commands/world-distill.tsx`（蒸馏操作使用 WorldDistillPanel）
- **新增** E2E 测试场景覆盖世界管理操作
- **修改** i18n key（菜单文案调整）
