## 1. 命令注册表

- [x] 1.1 创建 `src/cli/command-registry.ts`：定义 CommandDef 接口（name, description, group），导出 COMMANDS 数组，包含全部命令
- [x] 1.2 重构 `src/cli/commands/help.tsx`：从 command-registry 导入数据，移除内部硬编码的 COMMAND_GROUPS
- [x] 1.3 重构 `src/cli/command-parser.ts`：从 command-registry 导入 COMMANDS，移除内部硬编码的 KNOWN_COMMANDS

## 2. CommandPalette 组件

- [x] 2.1 创建 `src/cli/components/command-palette.tsx`：候选列表组件，接收 items（过滤后的命令列表）、selectedIndex、maxVisible（默认 8）
- [x] 2.2 实现滚动窗口逻辑：当候选项超过 maxVisible 时，根据 selectedIndex 计算可见窗口偏移
- [x] 2.3 实现 Cyberpunk 视觉样式：cyan 边框、magenta 标题 "COMMANDS"、cyan 选中项、dim 未选中项、命令名 + 描述两列对齐

## 3. TextInput 补全集成

- [x] 3.1 修改 `src/cli/components/text-input.tsx`：新增 completionItems prop（CommandDef[]），新增补全状态管理（open/closed, selectedIndex, filteredItems）
- [x] 3.2 实现补全触发逻辑：输入 `/` 开头时打开列表，输入变化时前缀过滤，删除 `/` 时关闭
- [x] 3.3 实现键盘处理：列表打开时 ↑↓ 导航、Tab 确认填入、Enter 确认并提交、Esc 关闭
- [x] 3.4 渲染 CommandPalette：列表打开时在 TextInput 下方渲染 CommandPalette 组件

## 4. App 集成

- [x] 4.1 修改 `src/cli/app.tsx`：导入 COMMANDS，传递给 TextInput 的 completionItems prop

## 5. 测试

- [x] 5.1 单元测试：command-registry 导出完整命令列表，每个命令有 name/description/group
- [x] 5.2 单元测试：filterCommands 前缀过滤、空前缀返回全部、无匹配返回空
- [x] 5.3 组件快照测试：CommandPalette 全量显示、过滤后显示、空列表、选中不同项、滚动提示
- [x] 5.4 组件快照测试：help 快照已更新（使用 registry 数据）
- [x] 5.5 回归：现有 help 和 command-parser 测试继续通过（108 个测试全部通过）
