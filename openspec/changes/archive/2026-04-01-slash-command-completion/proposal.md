## Why

REPL 中输入 `/` 开头的命令时没有自动补全，用户需要记住所有命令名称。输错后只能看到"未知命令"的模糊建议。对标 Claude Code 的补全体验，输入 `/` 后应立刻弹出候选列表，边输入边过滤，Tab/Enter 确认。

## What Changes

- 新增 `<CommandPalette />` ink 组件：在输入 `/` 时弹出的候选列表，支持实时前缀过滤、上下箭头选择、Tab/Enter 确认、Esc 关闭
- 修改 `<TextInput />` 组件：增加 Tab 键处理、监听 `/` 触发补全、管理补全状态
- 新增命令注册表：统一的命令名 + 描述映射，复用自 help 命令的数据，供补全和 help 共同消费
- 修改 `<App />` 组件：传递命令注册表给 TextInput
- 新增/更新对应的组件快照测试

## Capabilities

### New Capabilities

- `slash-completion`: 斜杠命令自动补全——输入 `/` 触发候选列表、前缀过滤、键盘导航选择、补全填入

### Modified Capabilities

- `repl-shell`: TextInput 组件增加补全集成，命令数据从硬编码提取为共享注册表

## Impact

- **修改文件**: `src/cli/components/text-input.tsx`, `src/cli/commands/help.tsx`, `src/cli/command-parser.ts`, `src/cli/app.tsx`
- **新增文件**: `src/cli/components/command-palette.tsx`, `src/cli/command-registry.ts`
- **测试**: 新增 command-palette 组件快照测试，更新 text-input 相关测试
