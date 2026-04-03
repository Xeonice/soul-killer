## Why

/create 流程中输入文件路径时，用户需要手动输入完整路径，没有文件系统补全。同时，整个创建流程无法中途退出，一旦开始只能走到底或出错。这两个问题严重影响使用体验。

## What Changes

- 新增 `<PathPalette />` 组件：文件系统路径补全，边输入边列出匹配的文件和目录，Tab 选中（目录展开下一级，文件填入完整路径），视觉风格与 CommandPalette 一致
- 修改 `<TextInput />` 组件：新增 `pathCompletion` 模式，在路径输入场景下触发 PathPalette
- 修改 `<CreateCommand />` 组件：路径输入步骤使用 pathCompletion；所有输入步骤支持 Esc 退出；新增 `onCancel` 回调
- 修改 `<App />` 组件：处理 create 的 onCancel（恢复 interactiveMode、清除 commandOutput）

## Capabilities

### New Capabilities

- `path-completion`: 文件系统路径自动补全——输入路径时实时列出匹配文件/目录、Tab 展开目录或确认文件、~ 展开为 home、目录/文件视觉区分

### Modified Capabilities

- `repl-shell`: TextInput 支持 pathCompletion 模式，支持 onEscape 回调
- `data-ingest`: /create 流程中路径输入使用文件系统补全；所有输入步骤支持 Esc 退出到 REPL

## Impact

- **新增文件**: `src/cli/components/path-palette.tsx`
- **修改文件**: `src/cli/components/text-input.tsx`, `src/cli/commands/create.tsx`, `src/cli/app.tsx`
- **测试**: 新增 path-palette 组件测试，更新 create 相关测试
