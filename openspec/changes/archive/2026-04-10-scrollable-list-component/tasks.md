## 1. ScrollableList 组件

- [x] 1.1 创建 `src/cli/components/scrollable-list.tsx`，实现 ScrollableList 组件：props 接口、滚动窗口计算、▲▼ 指示器、emptyMessage、title/hint 渲染

## 2. 消费方接入

- [x] 2.1 `/list` soul-list：在 `src/cli/commands/soul/list.tsx` 中用 ScrollableList 替换 soul-list 阶段的裸 `.map()` 渲染
- [x] 2.2 `/world` world-list：在 `src/cli/commands/world/world.tsx` 中用 ScrollableList 替换 world-list 阶段的裸 `.map()` 渲染

## 3. 验证

- [x] 3.1 运行 `bun run build` 确认类型检查通过
- [x] 3.2 运行 `bun run test` 确认现有测试通过（909/909）
