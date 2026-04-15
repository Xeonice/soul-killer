## 1. Phase 状态机重构

- [ ] 1.1 `src/cli/commands/system/install-views/installed-flow.tsx` — `Phase` 类型：删除 `confirm-uninstall`，新增 `uninstall-pick-targets { slug; cursor; selected: Set<number> }` + `confirm-uninstall-batch { slug; records: InstallRecord[] }` + `result-batch { items: Array<{ target:scope, path, status, backupPath?, reason? }> }`
- [ ] 1.2 action 菜单的 Uninstall handler：`installs.length === 1` 直接进 confirm-uninstall-batch（records 为单元素数组）；`> 1` 进 pick-targets，默认 `selected = new Set(installs.indices)`
- [ ] 1.3 删除旧 `runUninstall(slug, rec)`；新增 `runUninstallBatch(slug, records)`：循环调 `atomicUninstall({ path, backup: true })`，逐条 catch 并累计结果
- [ ] 1.4 Esc 路径：pick-targets → action menu；confirm-batch → pick-targets（保留勾选）；result-batch → list

## 2. UI 渲染

- [ ] 2.1 pick-targets 视图：复用多选样式（❯ ◉ / ◯）；每行 `target:scope` 占 22 字符 + 路径；底部 hint 行含 `↑↓ / space / a / Enter / Esc`
- [ ] 2.2 空选状态：`selected.size === 0` 时底部额外显示 `install.uninstall_empty_selection` 引导文案
- [ ] 2.3 confirm-uninstall-batch 视图：标题 `卸载 <slug> 的 N 处安装？`；列表每行 `• target:scope  <path>  → <path>.old-<ts>`；底部 `Y 确认 / N 取消`
- [ ] 2.4 result-batch 视图：成功项 `✓ target:scope  uninstalled  (backup: <path>)`；失败项 `✗ target:scope  failed  <reason>`（WARNING 色）；汇总行 `✓ N · ✗ M`

## 3. i18n

- [ ] 3.1 zh.json 新增 7 键：`install.uninstall_pick_title` / `install.uninstall_pick_hint` / `install.uninstall_empty_selection` / `install.uninstall_batch_confirm_title` / `install.uninstall_batch_confirm_prompt` / `install.uninstall_batch_complete` / `install.uninstall_batch_partial`
- [ ] 3.2 en.json 同步新增
- [ ] 3.3 ja.json 同步新增

## 4. E2E

- [ ] 4.1 `tests/e2e/20-install-tabs.test.ts` 新增场景 A："2 target seed + Uninstall → 进入 pick-targets 视图 → 看到两条勾选 → Enter → confirm 页显示两条 → Y → result 显示 ✓ 2"
- [ ] 4.2 新增场景 B："1 target seed + Uninstall → 直接进 confirm-batch（跳过 pick）→ Y → result 显示 ✓ 1"；验证不经过 pick-targets 中间态
- [ ] 4.3（可选）部分失败场景：seed 两个安装目录，一个设为只读触发权限错误 → Enter 批量执行 → result 显示 ✓ 1 · ✗ 1

## 5. 发布验证

- [ ] 5.1 `bun run build`（tsc --noEmit）通过
- [ ] 5.2 `bun run test` 全绿；新 e2e 场景绿
- [ ] 5.3 手工：启动 REPL，对一个 4-target skill 执行 `/install` → Installed tab → Enter → Uninstall → 看到 4 条全选 → 取消 1 条 → Enter → confirm 页显示 3 条 → Y → result 显示 ✓ 3
- [ ] 5.4 `openspec archive skill-uninstall-multi-target`（留给用户触发）
