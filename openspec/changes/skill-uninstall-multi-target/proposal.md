## Why

REPL `/install` 的 Installed Tab 在卸载时存在**数据对不上**的 bug：一个 skill 可能同时装在 4 个 target（claude-code / codex / opencode / openclaw）× 2 个 scope 上，但 `installed-flow.tsx:174` 硬编码 `rec = skill.installs[0]!`——只拔掉**第一个**记录，确认弹窗显示"卸载完成"，剩余 3 个 install 留在磁盘。

用户点 Uninstall 的正常心智是"把这个 skill 从我这里拿掉"——一次搞定。现在要重复进 4 遍菜单才能清干净，且每次进来还得"碰运气"看首个记录是哪个 target。

CLI 侧已经支持多 target（`skill uninstall <slug> --all-targets` 一键批量），REPL 侧却没对齐。

## What Changes

**REPL Installed Tab 卸载流程改造**
- Action 菜单的 `Uninstall` 不再直接跳到单 record 确认。若 skill 只有 1 个 install → 直接确认（保留当前路径）；若 > 1 → 先进**多选 target 视图**，默认全选，再进批量确认。
- 多选视图：每行列出 `target:scope` + 绝对路径，↑↓ 移动、`space` 勾选、`a` 全选、`Enter` 继续、`Esc` 返回 action 菜单。
- 批量确认：列出所选 target 条目 + 对应的备份路径预览；`Y/Enter` 执行，`N/Esc` 取消。
- 执行：循环调 `atomicUninstall`；每条独立，**一条失败不阻止其他**；结果页汇总 `N uninstalled · M failed`，失败项用 WARNING 色标出原因。

**i18n 新增键**
- `install.uninstall_pick_title` / `install.uninstall_pick_hint`
- `install.uninstall_batch_confirm_title` / `install.uninstall_batch_confirm_prompt`
- `install.uninstall_batch_complete` / `install.uninstall_batch_partial`
- `install.uninstall_empty_selection`（不勾任何项时的引导）

**测试**
- Unit：不需要新增（`atomicUninstall` 已覆盖；批量只是循环）
- REPL e2e：`tests/e2e/20-install-tabs.test.ts` 追加 1-2 个场景（多选 UI 渲染、部分失败汇总）

## Capabilities

### New Capabilities
_无新能力_（未引入全新用户可见的语义，只是把已有 `atomicUninstall` 的批量能力补到 UI 层。）

### Modified Capabilities
- `skill-manage`: Installed Tab 的 Uninstall action 从"单记录卸载"升级为"多 target 多选批量卸载"；`skill.installs.length > 1` 时默认全选进入 pick-targets 步，`=== 1` 时保留直接确认行为。

## Impact

**受影响代码**
- `src/cli/commands/system/install-views/installed-flow.tsx` — 新增 `uninstall-pick-targets` / `confirm-uninstall-batch` 两个 Phase；改写 `runUninstall` 为 `runUninstallBatch`；action 菜单的 Uninstall handler 按 installs 数量分流。
- `src/infra/i18n/locales/*.json`（zh / en / ja）— 7 个新键。

**受影响文档**
- 无 README 改动（UI 细节不在 README 里列举）；`openspec/specs/skill-manage/spec.md` 里 Installed Tab action menu 对应 Requirement 的 Scenario 会在本 change 同步时更新。

**数据 / 兼容**
- 无数据结构变化；`atomicUninstall` 契约不变。
- 向后兼容：CLI `skill uninstall` 行为不变。
- 非破坏性：用户当前的"单次卸载"路径（针对 `installs.length === 1` 的 skill）行为保持一致。
