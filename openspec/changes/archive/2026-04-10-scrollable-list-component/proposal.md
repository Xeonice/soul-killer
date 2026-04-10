## Why

项目中多处列表渲染使用裸 `.map()` 直接渲染所有 item，无高度限制。当 soul/world 数量超过终端高度时，列表挤掉其他 UI 元素。项目已有两个独立的滚动窗口实现（CommandPalette 的 `maxVisible=8` 和 ExportProtocolPanel 的 `WINDOW_SIZE=10`），但 `/list` 和 `/world` 的列表没有使用任何滚动机制。

## What Changes

- 新增 `ScrollableList` 通用组件，提供固定高度滚动窗口、cursor 跟随、▲▼ 溢出指示器
- `/list` 的 soul-list 阶段使用 ScrollableList 替换裸 `.map()`
- `/world` 的 world-list 阶段使用 ScrollableList 替换裸 `.map()`

## Capabilities

### New Capabilities
- `scrollable-list`: 通用固定高度滚动列表组件

### Modified Capabilities

（无行为变更，仅视觉改进）

## Impact

- **新增文件**: `src/cli/components/scrollable-list.tsx`
- **修改文件**: `src/cli/commands/soul/list.tsx`（soul-list 渲染）、`src/cli/commands/world/world.tsx`（world-list 渲染）
- **不影响**: 键盘交互逻辑、状态机、E2E 测试行为
