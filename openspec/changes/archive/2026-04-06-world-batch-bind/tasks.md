## 1. 绑定��扩展

- [x] 1.1 在 `src/world/binding.ts` 新增 `findSoulsBoundToWorld(worldName)` 函数：扫描所有 soul 的 bindings/ 目录，返回绑定了该 world 的 soul 名称列表（含 disabled）
- [x] 1.2 单元测试 `tests/unit/world-binding.test.ts` — findSoulsBoundToWorld 的正常、空、disabled 场景

## 2. WorldBindCommand 重写

- [x] 2.1 重写 `src/cli/commands/world-bind.tsx`：移除 soulDir/action props，改为只接收 worldName + onComplete
- [x] 2.2 实现 checkbox 多选列表 UI：listLocalSouls 获取所有 soul，findSoulsBoundToWorld 获取已绑定状态，↑↓移动 Space ���换 Enter 确认 Esc 取消
- [x] 2.3 实现确认逻辑：对比初始状态和当前状态，新勾选的 bindWorld(order=0)，取消勾选的 unbindWorld，不变的跳过
- [x] 2.4 实现结果摘要显示：绑定了几个、解绑了几个、无变化时提示
- [x] 2.5 实现空 soul 列表处理：无 soul 时显示提示并自动返回

## 3. World 命令集成

- [x] 3.1 修改 `src/cli/commands/world.tsx` ACTION_ITEMS：合并 bind/unbind 为单一"绑定管理"条目，移除 needsSoul
- [x] 3.2 修改 action-running 中 bind 分支：传递新的 WorldBindCommand props（只需 worldName）
- [x] 3.3 删除 action-running 中 unbind 分支（已合并到 bind）

## 4. i18n

- [x] 4.1 更新 zh/en/ja locale：新增 world.bind.title, world.bind.hint, world.bind.no_souls, world.bind.summary_bound, world.bind.summary_unbound, world.bind.no_changes；修改 bind action 的 label/desc

## 5. 测试

- [x] 5.1 组件测试 `tests/component/world-bind.test.tsx` — checkbox 渲染、toggle、确认后 bind/unbind 调用
