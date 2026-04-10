## Context

项目有两个已有的滚动实现可参考：
- `CommandPalette`（command-palette.tsx）：`maxVisible` prop，居中 cursor 滚动
- `ExportProtocolPanel` select zone（export-protocol-panel.tsx:219）：`WINDOW_SIZE=10`，cursor 偏上 3 行，▲▼ 指示器，border

## Goals / Non-Goals

**Goals:**
- 提取一个通用 `ScrollableList` 组件，统一滚动窗口逻辑
- 在 `/list` 和 `/world` 的列表中使用

**Non-Goals:**
- 不替换 CommandPalette 和 ExportProtocolPanel 现有的滚动实现（它们有各自的特殊需求如 border、multi-select）
- 不改变键盘交互逻辑（cursor 状态仍由父组件管理）

## Decisions

### 1. 组件 API

```tsx
interface ScrollableListProps<T> {
  items: T[]
  cursor: number
  maxVisible?: number               // 默认 10
  renderItem: (item: T, index: number, focused: boolean) => React.ReactNode
  emptyMessage?: string             // items 为空时显示
  title?: string                    // 列表标题
  hint?: string                     // 标题下方的提示文字
}
```

**为什么 cursor 由外部管理？** 因为 useInput 已经在父组件里处理键盘事件。ScrollableList 是纯渲染组件，不拥有状态。

### 2. 滚动算法

采用 ExportProtocolPanel 的"cursor 偏上"策略，cursor 保持在窗口偏上方约 1/3 处：

```
windowStart = max(0, min(cursor - 3, total - windowSize))
```

### 3. 溢出指示器

当有超出可见范围的 item 时，显示 ▲/▼ 和数量：
```
    ▲ 5 more
    ❯ item 6
      item 7
      ...
    ▼ 3 more
```

### 4. 文件位置

`src/cli/components/scrollable-list.tsx` — 与 command-palette、text-input 同级。
