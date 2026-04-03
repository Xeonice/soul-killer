## Why

`/publish` 功能（发布到 GitHub）当前使用率低且存在安全隐患（同步 `execSync` 执行 git 命令），暂时不需要保留。同时 `/use` 命令虽已有 soul 名称补全，但在 handler 层缺少存在性校验 — 不存在的 soul 名称会进入 `UseCommand` 组件的 not-found 状态，而非像 `/evolve` 那样在输入时就给出错误提示并跳回初始状态。

## What Changes

- **BREAKING** 移除 `/publish` 命令及其关联代码（`PublishCommand` 组件、command-registry 条目、i18n 键）
- **移除** `/link` 命令（依赖 publish 流程，一并清理）
- **增强** `/use` 命令：在 handler 层校验 soul 名称是否存在于 `listLocalSouls()` 中，不存在时显示 "SOUL NOT FOUND" 错误（含 `/list` 建议），跳回 `/` 初始状态

## Capabilities

### New Capabilities

（无）

### Modified Capabilities

- `command-arg-completion`: `/use` 的补全行为不变，但需确认与校验逻辑的一致性
- `slash-completion`: 移除 `/publish` 和 `/link` 命令的补全条目

## Impact

- **CLI 层** (`src/cli/app.tsx`): 移除 `case 'publish'` 和 `case 'link'` 分支，增强 `case 'use'` 的校验逻辑
- **命令注册** (`src/cli/command-registry.ts`): 移除 publish、link 模板
- **组件**: `src/cli/commands/publish.tsx` 和 `src/cli/commands/link.tsx` 可删除
- **i18n**: 移除 `cmd.publish`、`cmd.link` 键
- **测试**: 更新涉及 publish/link 的测试和快照
