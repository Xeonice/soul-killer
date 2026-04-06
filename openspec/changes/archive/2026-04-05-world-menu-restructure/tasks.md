## 1. 菜单结构重构

- [x] 1.1 重写 `src/cli/commands/world.tsx`：WorldCommand 改为 WorldPhase 状态机（top-menu → world-list → action-menu → action-running），顶层只有「创建」和「管理」
- [x] 1.2 实现 world-list phase：方向键选择世界、Enter 进入子操作、ESC 返回顶层
- [x] 1.3 实现 action-menu phase：选中世界后展示 6 个子操作（详情/条目/蒸馏/进化/绑定/解绑），绑定/解绑无 Soul 时禁用
- [x] 1.4 实现 action-running phase：渲染对应子命令组件，完成后返回 action-menu
- [x] 1.5 无已安装世界时「管理」显示禁用
- [x] 1.6 更新 i18n key（zh/en/ja：顶层菜单「管理」文案、子操作菜单标题等）

## 2. 蒸馏/进化路径收集内置

- [x] 2.1 修改 WorldDistillCommand：sourcePath 改为可选 prop，未提供时组件内部展示 TextInput 收集路径
- [x] 2.2 修改 WorldEvolveCommand：同上，sourcePath 可选，未提供时内部收集
- [x] 2.3 蒸馏操作使用 WorldDistillPanel 展示进度（替换纯文本进度）

## 3. E2E 测试

- [x] 3.1 创建 `tests/e2e/world-manage-e2e.ts`：前置条件——通过 fictional-original + 空数据源快速创建测试世界
- [x] 3.2 E2E：`/world` → 管理 → 世界列表展示已创建的世界
- [x] 3.3 E2E：选中世界 → 详情 → 展示正确信息
- [x] 3.4 E2E：选中世界 → 条目 → 添加条目 → 验证写入
- [x] 3.5 E2E：选中世界 → 蒸馏（提供 markdown fixture 路径）→ 蒸馏面板展示 → 审查
- [x] 3.6 E2E：选中世界 → ESC → 返回世界列表 → ESC → 返回顶层

## 4. 回归验证

- [x] 4.1 更新 world-commands 组件测试（菜单结构变更后的 snapshot）
- [x] 4.2 运行全量测试：`bun run test`
- [x] 4.3 运行 world-create E2E 确保创建流程不受影响
