## MODIFIED Requirements

### Requirement: 交互向导（REPL `/install` 无参）

REPL `/install` 无参时 SHALL 进入**双 Tab 容器**：`Available`（可装）与 `Installed`（已装）。默认进入 Available Tab，其内容为原 6 步向导的前 5 步（pick-skills → pick-targets → pick-scope → preview → installing → done）；Installed Tab 的行为由 `skill-manage` 能力定义。用户 SHALL 能用 `Tab` / `Shift-Tab` 切换；Esc 在 Tab 层退出命令，在子流里先回到 Tab 层。带 slug 参数（`/install <slug>`）SHALL 直接进入 Available Tab 并跳过 pick-skills 步骤。

#### Scenario: 完整向导流程（Available Tab）

- **WHEN** 用户在 REPL 输入 `/install`，保持在 Available Tab
- **THEN** 依次渲染 pick-skills → pick-targets → pick-scope → preview → installing → done，每步用 ink 组件交互

#### Scenario: 带 slug 参数跳步

- **WHEN** 用户在 REPL 输入 `/install fate-zero`
- **THEN** 默认进入 Available Tab，跳过 pick-skills，直接进入 pick-targets

#### Scenario: 切换到 Installed Tab

- **WHEN** 用户按 Tab 从 Available 切换到 Installed
- **THEN** 视图切换为 Installed Tab 的列表视图（列表内容与操作菜单由 `skill-manage` 能力定义）；再按 Tab 切回 Available

#### Scenario: Esc 取消

- **WHEN** 向导任一步骤用户按 Esc
- **THEN** 若在子流（pick-skills/pick-targets/…）中，回退到 Tab 层；若已在 Tab 层，退出 `/install` 命令；安装过程中的 Esc 按现有回滚语义处理

### Requirement: 冲突处理（已存在的 skill）

CLI `skill install` SHALL 在目标目录已存在时默认 skip 并在摘要中标注 `skipped (use --overwrite or 'skill update')`；加 `--overwrite` 则 rename 旧目录为 `<path>.old-<ts>` 再写入。REPL `/install` 的 Available Tab SHALL **不再通过 UI state 硬编码 `overwrite=false`**：Available Tab 的安装动作始终以 `overwrite=false` 运行，冲突时引导用户去 Installed Tab 使用 Update 操作；Installed Tab 的 Update action 以 `overwrite=true` 运行。

#### Scenario: CLI 默认 skip

- **WHEN** 用户执行 `soulkiller skill install fate-zero --to claude-code`，且 `~/.claude/skills/fate-zero/` 已存在
- **THEN** 摘要行 SHALL 为 `• fate-zero  claude-code  skipped  already installed (use --overwrite or 'skill update')`；退出码 0

#### Scenario: CLI --overwrite

- **WHEN** 用户执行 `soulkiller skill install fate-zero --to claude-code --overwrite`
- **THEN** 原目录 SHALL 被 rename 为 `<path>.old-<timestamp>`；新内容写入后若成功则保留备份（或交给 `cleanupStaleOld`）；失败则 rollback（删除新目录，rename 备份回原位）

#### Scenario: REPL Available Tab 冲突引导

- **WHEN** 用户在 Available Tab 尝试安装一个已装 skill
- **THEN** REPL SHALL 以 toast / 提示栏告知"该 target 已装该 skill；请切换到 Installed Tab 使用 Update 操作"；不执行任何写入

#### Scenario: REPL Installed Tab Update 自动覆盖

- **WHEN** 用户在 Installed Tab 触发 Update
- **THEN** 底层等价 `installer.atomicInstall({ overwrite: true })`，原目录 rename 为 `.old-<ts>`
