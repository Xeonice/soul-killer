## ADDED Requirements

### Requirement: `/upgrade` REPL 命令
REPL SHALL 注册 `/upgrade` 命令，其行为是在 REPL 内部完成整套二进制升级流程（查询版本 → 确认 → 下载 → 校验 → 原子替换），**全程不退出 REPL**。该命令 MUST 复用现有 `runUpdate()` 的下载、sha256 校验、原子替换、Windows self-rename 逻辑，并以可重入的方式在 ink 渲染循环中执行。

#### Scenario: 查询阶段
- **WHEN** 用户在 REPL 输入 `/upgrade`
- **THEN** 渲染 "checking latest release…" → 查询完成后展示本地版本 / 最新版本 / release notes 摘要 / [Y] 升级 [N] 取消

#### Scenario: 已是最新版
- **WHEN** `/upgrade` 检测到本地版本 == 远端最新
- **THEN** 显示 "Already up to date (vX.Y.Z)"，不进入确认流程，命令在按 Enter/Esc 后关闭

#### Scenario: 用户确认并升级成功
- **WHEN** 确认界面用户按 Y
- **THEN** UI 切到 "upgrading" 状态；流程通过 progress callback 实时渲染 "downloading X/Y MB" / "verifying checksum" / "replacing binary" 状态；升级成功后 UI 渲染明显视觉强调的 "Upgrade complete — current session stays on vX.Y.Z until restart" 文案

#### Scenario: 用户取消
- **WHEN** 确认界面用户按 N 或 Esc
- **THEN** 不执行任何下载或替换，返回 REPL 主界面

### Requirement: 当前会话运行旧代码
系统 SHALL 在升级成功后显式告知用户，当前 REPL 进程仍运行旧版本代码；新功能、bug 修复、engine_version 升级只有在 `/exit` 并重启 `soulkiller` 后生效。此提示 MUST 以视觉对比（warning 色 / 高亮背景 / 多行展示）突出显示，避免用户误以为当前会话已切换到新版。

#### Scenario: 升级完成提示
- **WHEN** `/upgrade` 成功完成二进制替换
- **THEN** UI 包含明显强调的警告："Current session continues on v<old>. Run /exit and restart to use v<new>."

#### Scenario: 升完后尝试用新 engine skill
- **WHEN** 升级成功但用户未重启，此后尝试 `/install` 一个需要新 engine_version 的 skill
- **THEN** `/install` 报告 "engine too high"（正常行为，因为当前进程仍是旧二进制逻辑）；错误文案引导用户 `/exit` 重启

### Requirement: 升级期间输出隔离
`runUpdate()` SHALL 支持 `silent: true` 与 `onProgress` 参数。在 REPL 调用下，该函数 MUST NOT 直接使用 `console.log/warn/error` 写 stdout（会污染 ink 渲染循环）；所有阶段事件、错误信息 MUST 通过 `onProgress` 回调上报，由 `UpgradeCommand` 组件渲染。CLI 直接调用（`soulkiller --update`）保持原有 console 输出行为。

#### Scenario: REPL 调用不污染输出
- **WHEN** `UpgradeCommand` 在 REPL 内调用 `runUpdate({ silent: true, onProgress })`
- **THEN** 升级全程 stdout 无直接 console 输出；所有 phase 信息通过 `onProgress` 上报并在 ink 组件内渲染

#### Scenario: CLI 直接调用保持现有行为
- **WHEN** 用户执行 `soulkiller --update`（不走 REPL）
- **THEN** `runUpdate()` 以默认参数调用，console.log 等输出不变

### Requirement: `/upgrade --check` 只查不升
`/upgrade` SHALL 支持 `--check` 参数，仅查询远端版本并打印对比，不进入确认界面。

#### Scenario: 检查模式
- **WHEN** 用户输入 `/upgrade --check`
- **THEN** 输出 "local: vX.Y.Z, remote: vA.B.C" 后返回 REPL，不触发升级

### Requirement: 升级进行时禁止取消
升级阶段（下载 + 校验 + 替换）执行期间 SHALL 忽略用户的 Esc 按键，以避免中途中断导致 `<exe>.old` 等状态残留。UI MUST 在该阶段显示 "upgrade in progress, cannot cancel" 提示。

#### Scenario: 下载中按 Esc
- **WHEN** `/upgrade` 在 downloading/verifying/replacing 任一阶段，用户按 Esc
- **THEN** UI 保持当前进度不变，显式提示该操作不可取消；升级继续

### Requirement: `/upgrade --check` 只查不升
`/upgrade` SHALL 支持 `--check` 参数，仅查询远端版本并打印对比，不进入确认界面。

#### Scenario: 检查模式
- **WHEN** 用户输入 `/upgrade --check`
- **THEN** 输出 "local: vX.Y.Z, remote: vA.B.C" 后返回 REPL，不触发升级


### Requirement: 与 `skill install` 的联动
当 `/install` 因 skill 的 `engine_version` 超本机支持而 abort 时，错误文案 SHALL 直接指路 `/upgrade`（REPL 内）或 `soulkiller --update`（CLI）。

#### Scenario: engine 过高提示
- **WHEN** 用户在 REPL 跑 `/install fate-zero`，而 fate-zero 需要 engine_version 4 但本机只支持 3
- **THEN** 错误界面包含："Run `/upgrade` to update soulkiller first, then retry /install"

### Requirement: 与 skill 升级的语义分离
`/upgrade` SHALL 只升级 soulkiller 二进制本体，不得触碰已装 skill 的 `runtime/engine.md`；skill 的 engine 升级是 `soulkiller skill upgrade` 命令的职责。`/upgrade` 的文档与 help 文本 MUST 明确说明这一区分。

#### Scenario: /upgrade 不改 skill
- **WHEN** 用户执行 `/upgrade` 并完成二进制升级
- **THEN** `~/.claude/skills/<any>/runtime/engine.md` 内容未被修改

#### Scenario: 明示区分
- **WHEN** 用户执行 `/upgrade --help`（如提供）或查阅 REPL help
- **THEN** 文档说明 "upgrades the soulkiller binary itself; to upgrade skill engines use `soulkiller skill upgrade`"
