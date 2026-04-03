## Why

`/feed`（增量导入数据）和 `/distill`（重新蒸馏）是 soul 数据管道的两个阶段，用户几乎总是先 feed 再 distill。将它们合并为一个 `/evolve` 命令可以减少操作步骤，同时为命令添加 soul 名称参数补全，让用户无需先 `/use` 即可直接操作目标 soul。

## What Changes

- **移除** `/feed` 和 `/distill` 两个独立命令
- **新增** `/evolve <soul>` 命令，合并 feed + distill 流程：
  1. 用户输入 `/evolve` 后，触发参数补全面板，显示从 `list` 获取的所有 soul 名称
  2. 用户可输入文本筛选 soul 列表
  3. 选择 soul 后进入交互模式：先选择数据源路径进行 feed，完成后自动进入 distill 阶段
  4. 如果用户输入的 soul 名称完全不存在于列表中，显示错误提示并跳回 `/` 命令初始状态
- **更新** `ARG_COMPLETION_MAP` 为 `evolve` 命令注册 soul 名称补全（复用 `use` 命令已有的 `listLocalSouls()` provider）
- **更新** command-registry 移除 feed/distill，注册 evolve
- **更新** i18n 键值

## Capabilities

### New Capabilities
- `evolve-command`: 合并 feed+distill 的 `/evolve <soul>` 命令，包含参数补全、输入校验、错误回退逻辑

### Modified Capabilities
- `command-arg-completion`: 为 `evolve` 命令新增 soul 名称参数补全条目
- `slash-completion`: 移除 feed/distill，添加 evolve 到命令面板

## Impact

- **CLI 层** (`src/cli/app.tsx`): 移除 `case 'feed'` 和 `case 'distill'` 分支，新增 `case 'evolve'` 分支
- **命令注册** (`src/cli/command-registry.ts`): 移除 feed/distill 模板，新增 evolve
- **组件**: 新增 `EvolveCommand` 组件（或重构现有 `FeedCommand` + `DistillCommand`）
- **ARG_COMPLETION_MAP** (`src/cli/app.tsx`): 添加 evolve 条目
- **i18n**: 新增 `cmd.evolve` 键，移除 `cmd.feed` / `cmd.distill`
- **测试**: 需更新涉及 feed/distill 的单元测试和组件测试
- **BREAKING**: `/feed` 和 `/distill` 命令将不再可用
