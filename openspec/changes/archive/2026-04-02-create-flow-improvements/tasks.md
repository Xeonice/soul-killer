## 1. PathPalette 组件

- [x] 1.1 创建 `src/cli/components/path-palette.tsx`
- [x] 1.2 创建 `src/cli/path-resolver.ts`
- [x] 1.3 PathPalette 视觉样式

## 2. TextInput 扩展

- [x] 2.1 TextInput 新增 `pathCompletion?: boolean` prop
- [x] 2.2 TextInput 新增 `onEscape?: () => void` prop
- [x] 2.3 pathCompletion Tab 行为：目录展开 / 文件确认
- [x] 2.4 渲染 PathPalette

## 3. Create 流程改造

- [x] 3.1 CreateCommand 新增 `onCancel` prop
- [x] 3.2 所有输入步骤的 TextInput 传入 onEscape → 调用 onCancel
- [x] 3.3 sources CheckboxSelect 步骤支持 Esc 退出
- [x] 3.4 ingesting/distilling 阶段支持 Esc 退出
- [x] 3.5 source-path 步骤启用 pathCompletion

## 4. App 集成

- [x] 4.1 App 传递 onCancel 给 CreateCommand

## 5. 测试

- [x] 5.1 单元测试：path-resolver（expandTilde, parsePath, listEntries, buildDisplayPath）
- [x] 5.2 组件快照测试：PathPalette（混合列表、空列表、选中项、滚动提示）
- [x] 5.3 回归：131 个测试全部通过
