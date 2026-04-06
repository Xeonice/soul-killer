## 1. Soul /list 交互化

- [x] 1.1 重写 `src/cli/commands/list.tsx`：ListCommand 改为交互式（ListPhase 状态机：soul-list → action-menu → action-running → confirm-delete）
- [x] 1.2 实现 soul-list phase：方向键选择 Soul、Enter 进入子操作、ESC 关闭
- [x] 1.3 实现 action-menu phase：4 个子操作（详情/加载/进化/删除）
- [x] 1.4 实现详情查看：展示 manifest 信息
- [x] 1.5 实现加载：触发 onUse 回调
- [x] 1.6 实现进化：渲染 CreateCommand(supplementSoul)
- [x] 1.7 实现删除：confirm-delete phase，确认后 rmSync，返回 soul-list
- [x] 1.8 app.tsx `/list` 改为 interactiveMode + 传入 onUse/onClose

## 2. World 删除

- [x] 2.1 world.tsx ACTION_ITEMS 新增 `delete` 选项
- [x] 2.2 world.tsx action-running 渲染删除确认（confirm-delete phase），确认后 deleteWorld()，返回 world-list
- [x] 2.3 WorldPhase 类型新增 `confirm-delete`

## 3. i18n + 测试

- [x] 3.1 新增 i18n key（zh/en/ja）：Soul 子操作文案、删除确认提示、World 删除文案
- [x] 3.2 type check: `bun run build`
- [x] 3.3 组件测试: `bun vitest run tests/unit/ tests/component/`
