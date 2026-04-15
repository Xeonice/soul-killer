## MODIFIED Requirements

### Requirement: REPL Installed Tab 操作菜单

在 Installed tab 选中一条 skill 后按 Enter，REPL SHALL 弹出 action 菜单，选项至少包含：`Update to <new-version>`（仅在有新版时出现）、`Install to other targets`（仅在有未覆盖 target 时出现）、`Details`、`Uninstall`、`← Back`。`Uninstall` 根据该 skill 的 install 数量分流：仅 1 条 install 时直接进入确认；多条 install 时先进入多选 target 视图。

#### Scenario: Update 动作

- **WHEN** 用户选择 `Update to <new>`
- **THEN** REPL 调用底层 `update` 路径（等价 `skill update <slug>`）；进度面板展示下载/安装；完成后回到 Installed 列表，状态刷新为 up-to-date

#### Scenario: 追装到其他 target

- **WHEN** 用户选择 `Install to other targets`
- **THEN** REPL 进入 target 多选子流；完成后等价 `skill install <slug> --to <new-targets>`；选过的 target 已勾选且禁用

#### Scenario: 单 install 卸载二次确认

- **WHEN** 用户选择 `Uninstall` 且该 skill 只有 1 条 install 记录
- **THEN** REPL SHALL 弹出二次确认对话框，显示单一目标路径与备份位置；`Y / Enter` 执行，`N / Esc` 取消

#### Scenario: 多 install 卸载进入多选视图

- **WHEN** 用户选择 `Uninstall` 且该 skill 有 > 1 条 install 记录
- **THEN** REPL SHALL 进入 "Uninstall pick-targets" 视图：列出全部 install 记录（`target:scope` + 绝对路径），默认全部勾选；`space` 切换勾选、`a` 全选、`Enter` 继续、`Esc` 返回 action 菜单

#### Scenario: Details 查看

- **WHEN** 用户选择 `Details`
- **THEN** REPL 展示该 skill 的 SKILL.md 首屏（front-matter + 前若干行描述）和安装元信息

## ADDED Requirements

### Requirement: 多 install 卸载的 pick-targets 视图

REPL `/install` 的 Installed Tab SHALL 在多 install skill 的 Uninstall 流程中提供一个"pick-targets"视图：以多选列表展示所有 install 记录，每行含 `target:scope` 标签与绝对路径；支持 `↑↓` 移动、`space` 勾选、`a` 全选、`Enter` 提交、`Esc` 返回。视图默认全部 install 处于勾选状态。空选时 `Enter` 不前进，底部展示引导文案。

#### Scenario: 默认全选

- **WHEN** 进入 pick-targets 视图
- **THEN** 全部 install 记录 SHALL 处于勾选状态（◉）；光标停在第一行

#### Scenario: 空选禁止前进

- **WHEN** 用户取消所有勾选并按 `Enter`
- **THEN** 视图 SHALL 不前进到下一步；底部显示 `install.uninstall_empty_selection` 对应的引导文案（如"至少勾选一项"）

#### Scenario: Esc 返回 action 菜单

- **WHEN** 用户在 pick-targets 视图按 `Esc`
- **THEN** REPL SHALL 返回 action 菜单（而不是退出 `/install` 命令）；勾选状态丢弃

#### Scenario: 全选快捷键

- **WHEN** 用户在部分勾选状态下按 `a`
- **THEN** 全部 install SHALL 被设为勾选

### Requirement: 批量卸载确认与执行

REPL 在 pick-targets 提交后 SHALL 进入"confirm-uninstall-batch"视图，列出所选 install 的清单（每条含 target:scope、路径、备份路径预览）。`Y / Enter` 执行批量卸载；`N / Esc` 返回 pick-targets（保留勾选状态）。执行时按顺序调 `atomicUninstall`，**单条失败不阻止其他**；执行完毕进入 result 视图，汇总 `N uninstalled · M failed`，失败项以 WARNING 色展示 target:scope + 错误 message。

#### Scenario: 全成功

- **WHEN** 2 个所选 install 的 `atomicUninstall` 都成功
- **THEN** result 视图 SHALL 显示 `✓ 2 uninstalled · 0 failed`；每条备份路径被列出

#### Scenario: 部分失败继续后续

- **WHEN** 2 个所选 install 中第一条抛错（例如文件被锁），第二条正常
- **THEN** REPL SHALL 继续执行第二条；result 视图汇总 `✓ 1 uninstalled · ✗ 1 failed`；失败项以 WARNING 色渲染，含错误 message；成功项显示备份路径

#### Scenario: 确认前 Esc 保留勾选

- **WHEN** 用户在 confirm-uninstall-batch 视图按 `Esc`
- **THEN** REPL SHALL 返回 pick-targets 视图；先前的勾选状态保持不变

#### Scenario: 结果页返回

- **WHEN** 用户在 result 视图按 `Enter` 或 `Esc`
- **THEN** REPL SHALL 返回 Installed 列表；列表已按卸载后的状态刷新
