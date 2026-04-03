## Why

`/use <name>` 需要用户记住并精确输入 soul 名称，没有补全。同时加载别人的分身后直接切换到 RELIC prompt，缺少过渡动画——不符合 Cyberpunk 2077 中 Relic 芯片激活的仪式感。

## What Changes

- `/use` 命令增加 soul 名补全：输入 `/use ` 后自动列出本地已有的 soul，支持前缀过滤、上下选择、Tab/Enter 确认
- 新增 `<RelicLoadAnimation />` 组件：soul 切换时播放 Relic 激活动画（neural link → heartbeat 激活 → status sync → soul info 展示）
- 主 TextInput 增加命令参数补全能力：当输入匹配特定命令前缀（如 `/use `）时，切换补全数据源

## Capabilities

### New Capabilities

- `relic-load-animation`: Relic 芯片激活动画——neural link 建立、心电图从平到活跃、RELIC STATUS 进度条、soul 信息展示
- `command-arg-completion`: 命令参数补全——特定命令（如 /use）后自动补全参数，复用 CommandPalette UI

### Modified Capabilities

- `soul-package`: /use 命令集成参数补全和加载动画
- `repl-shell`: TextInput 支持命令参数补全数据源

## Impact

- **新增文件**: `src/cli/animation/relic-load-animation.tsx`, `src/cli/soul-resolver.ts`
- **修改文件**: `src/cli/components/text-input.tsx`, `src/cli/commands/use.tsx`, `src/cli/app.tsx`
- **测试**: 新增 relic-load-animation 快照测试，soul-resolver 单元测试
