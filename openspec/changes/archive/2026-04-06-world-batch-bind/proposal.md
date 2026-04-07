## Why

当前 `/world → bind` 操作一次只能绑定一个 world 到当前已加载的 soul，且必须先 `/use` 加载 soul 才能操作。这对于需要将一个 world 绑定到多个 soul 的场景很低效。用户需要一种从 world 视角出发，一次性管理所有 soul 绑定关系的方式。

## What Changes

- **重写 WorldBindCommand**: 从"单 soul + 输入 order"改为多选 checkbox 列表，列出所有本地 soul，已绑定的预勾选
- **合并 bind/unbind**: action menu 中 bind 和 unbind 合并为一个"绑定管理"入口，通过 checkbox toggle 同时支持绑定和解绑
- **移除 soulDir 依赖**: bind 操作不再要求当前已加载 soul，直接扫描所有本地 soul
- 新绑定默认 order = 0，用户后续按需调整
- 取消勾选的 soul 自动 unbind

## Capabilities

### New Capabilities

- `world-batch-bind`: 从 world 视角批量管理 soul 绑定关系的多选 checkbox UI

### Modified Capabilities

- `world-commands`: action menu 合并 bind/unbind 为单一"绑定管理"入口，移除 needsSoul 限制
- `world-binding`: 新增反向查询函数（给定 world name，查出所有绑定了它的 soul）

## Impact

- **修改文件**: `src/cli/commands/world-bind.tsx`（重写）、`src/cli/commands/world.tsx`（合并 action）、`src/world/binding.ts`（新增反向查询）
- **i18n**: 更新 bind 相关文案，新增多选 UI 文案
- **无破坏性变更**: binding 文件格式不变，只是操作方式改变
