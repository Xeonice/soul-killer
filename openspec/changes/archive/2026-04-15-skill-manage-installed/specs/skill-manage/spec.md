## ADDED Requirements

### Requirement: 已装 skill 扫描器

系统 SHALL 提供 `scanInstalled()` 能力，扫描全部 4 个 target（claude-code / codex / opencode / openclaw）× 2 个 scope（global / project）的 skill 根目录，对每个含 `soulkiller.json` 的条目产出 `InstallRecord`；同一 slug 在不同 (target, scope) 下的多条记录合并为单个 `InstalledSkill`。

#### Scenario: 单 target 单 scope 已装

- **WHEN** `~/.claude/skills/fate-zero/soulkiller.json` 存在，内容含 `version: "0.3.1"` 与 `engine_version: 2`
- **THEN** `scanInstalled()` 返回的数组包含一条 `InstalledSkill { slug: "fate-zero", installs: [{ target: "claude-code", scope: "global", version: "0.3.1", engineVersion: 2, hasLegacyRuntimeBin: false }] }`

#### Scenario: 同一 slug 跨多个 target

- **WHEN** `~/.claude/skills/fate-zero/` 和 `~/.agents/skills/fate-zero/` 都已装
- **THEN** 返回一条 `InstalledSkill`，其 `installs` 数组含 2 条记录，分别对应 `claude-code` 与 `codex` target

#### Scenario: 识别残留的废弃路径

- **WHEN** skill 根目录下存在 `runtime/bin/state` 或 `runtime/bin/doctor.sh`
- **THEN** 对应 `InstallRecord.hasLegacyRuntimeBin` 字段 SHALL 为 `true`

#### Scenario: 缺 soulkiller.json 的老包

- **WHEN** skill 目录存在但无 `soulkiller.json`，或 `soulkiller.json` 缺 `version` 字段
- **THEN** `InstallRecord.version` 为 `null`；`engineVersion` 在缺失时同样为 `null`；该条目仍被列入扫描结果

#### Scenario: project scope 扫描边界

- **WHEN** `scanInstalled()` 传入 `cwd` 且该目录下存在 `.claude/skills/`
- **THEN** 该 project scope 路径被扫描；全局 scope（`~/.claude/skills/`）同样被扫描；同一 slug 在两个 scope 的记录视为独立 `InstallRecord`

### Requirement: catalog 版本 diff

系统 SHALL 提供 `diffAgainstCatalog(installed, catalog)` 能力，对每个已装 slug 计算 `UpdateStatus`（`up-to-date` / `updatable` / `unknown-version` / `not-in-catalog`），并按 (target, scope) 记录 per-install 状态。

#### Scenario: 已是最新版

- **WHEN** 已装版本字符串与 catalog 同 slug 条目的 `version` 严格相等
- **THEN** 该 slug 的 `UpdateStatus` SHALL 为 `{ kind: "up-to-date" }`

#### Scenario: 有新版可升级

- **WHEN** 已装版本 `"0.3.1"`、catalog 版本 `"0.4.0"`
- **THEN** `UpdateStatus` SHALL 为 `{ kind: "updatable", from: "0.3.1", to: "0.4.0" }`

#### Scenario: 本地版本未知

- **WHEN** 已装 skill 无 `soulkiller.json` 或缺 `version` 字段
- **THEN** `UpdateStatus` SHALL 为 `{ kind: "unknown-version", reason: "no-soulkiller-json" | "no-version-field" }`

#### Scenario: catalog 无该 slug

- **WHEN** 已装 slug 在 catalog 中不存在
- **THEN** `UpdateStatus` SHALL 为 `{ kind: "not-in-catalog" }`

### Requirement: 原子卸载器

系统 SHALL 提供 `atomicUninstall({ path, backup })` 能力，以 rename→`<path>.old-<ts>` 的方式移除已装 skill 目录，与 `installer.ts` 的 rollback 策略对称。

#### Scenario: 成功卸载并备份

- **WHEN** 目标路径存在且 `backup=true`
- **THEN** 目标目录 SHALL 被 rename 为 `<path>.old-<timestamp>`；返回 `{ backupPath }` 包含备份路径

#### Scenario: 跨文件系统 rename 失败

- **WHEN** rename 因 EXDEV 失败
- **THEN** 回退到递归复制+删除；原位置必须被完整移除；失败则回滚（将已复制的数据清理）

#### Scenario: 无备份模式

- **WHEN** `backup=false`
- **THEN** 直接递归删除目标目录；返回 `{ backupPath: null }`

### Requirement: CLI `skill list` 子命令

CLI SHALL 在 `soulkiller skill list` 下列出已装 skill。默认输出人类可读表格；`--catalog` 显示 catalog 全量；`--updates` 仅显示有新版的已装 skill；`--json` 输出机器可读 JSON；`--scan-dir <path>` 指定额外的 project scope 扫描根。

#### Scenario: 列出全部已装

- **WHEN** 用户执行 `soulkiller skill list`
- **THEN** 输出每条已装 skill 一行，含 slug / 当前版本 / catalog 最新版本 / 状态徽章（up-to-date / update-available / unknown / not-in-catalog）/ 覆盖的 target × scope 组合

#### Scenario: 仅显示有新版

- **WHEN** 用户执行 `soulkiller skill list --updates`
- **THEN** 仅列出 `UpdateStatus.kind === "updatable"` 的条目；无更新时输出 `All skills up to date` 并退出码 0

#### Scenario: JSON 输出

- **WHEN** 用户执行 `soulkiller skill list --json`
- **THEN** stdout SHALL 是合法 JSON：`{ "installed": InstalledSkill[], "diff": SkillDiff[], "catalog_source": "network" | "cache" | "skipped" }`

#### Scenario: catalog 全量

- **WHEN** 用户执行 `soulkiller skill list --catalog`
- **THEN** 列出 catalog 中全部 skill 条目，标注每条在本地的安装状态

### Requirement: CLI `skill update` 子命令

CLI SHALL 在 `soulkiller skill update` 下提供"拉 catalog 新版本并覆盖安装"的能力。`skill update <slug>...` 升级指定 slug；`--all` 升级全部已装；`--check` 为 dry-run；`--exit-code-if-updates` 配合 `--check` 在发现更新时返回 1；`--force` 允许对 `unknown-version` 的旧包强制重装。

#### Scenario: 单 slug 升级

- **WHEN** 用户执行 `soulkiller skill update fate-zero`，且 catalog 版本 `"0.4.0"` 新于本地 `"0.3.1"`
- **THEN** CLI SHALL 下载 v0.4.0 `.skill`，校验 sha256，对每个已覆盖的 (target, scope) 组合执行 `installer.atomicInstall({ overwrite: true })`；写入前旧目录 rename 为 `.old-<ts>` 备份

#### Scenario: 已是最新版

- **WHEN** 用户执行 `soulkiller skill update fate-zero`，本地与 catalog 版本相同
- **THEN** 输出 `fate-zero already up to date (v<n>)`；不触发下载；退出码 0

#### Scenario: 升级所有

- **WHEN** 用户执行 `soulkiller skill update --all`
- **THEN** 对每条已装且有新版的 slug 执行升级；任一失败不阻塞其他；摘要列出成功/失败；全部成功退出码 0，任一失败退出码 1

#### Scenario: dry-run 检查

- **WHEN** 用户执行 `soulkiller skill update --all --check`
- **THEN** 不执行下载/写入；stdout 列出"将会升级"的条目；默认退出码 0

#### Scenario: CI 友好退出码

- **WHEN** 用户执行 `soulkiller skill update --all --check --exit-code-if-updates` 且存在可升级条目
- **THEN** 退出码 SHALL 为 1；stdout 仍列出候选

#### Scenario: 未装的 slug

- **WHEN** 用户执行 `soulkiller skill update not-installed-slug`
- **THEN** CLI 输出错误 `not-installed-slug is not installed; use 'soulkiller skill install' first`；退出码 2

### Requirement: CLI `skill uninstall` 子命令

CLI SHALL 在 `soulkiller skill uninstall <slug>` 下移除已装 skill。默认作用于 `--to claude-code --scope global`；`--to <target>` 覆盖目标；`--scope <scope>` 覆盖范围；`--all-targets` 移除该 slug 在所有 (target, scope) 下的安装；`--no-backup` 跳过 `.old-<ts>` 备份。

#### Scenario: 默认单 target 卸载

- **WHEN** 用户执行 `soulkiller skill uninstall fate-zero`，且 `~/.claude/skills/fate-zero/` 存在
- **THEN** 目标目录 SHALL 被 rename 为 `~/.claude/skills/fate-zero.old-<ts>`；输出 `✓ fate-zero  claude-code  uninstalled (backup: …old-<ts>)`；退出码 0

#### Scenario: 全 target 卸载

- **WHEN** 用户执行 `soulkiller skill uninstall fate-zero --all-targets`，且该 slug 在 claude-code 与 codex 下都已装
- **THEN** 两个路径都被 rename 备份；摘要列出两条卸载记录

#### Scenario: 未装的 slug

- **WHEN** 目标 (target, scope) 下未装该 slug
- **THEN** CLI 输出 `not installed`；退出码 1

#### Scenario: 无备份模式

- **WHEN** 用户执行 `soulkiller skill uninstall fate-zero --no-backup`
- **THEN** 目录 SHALL 被直接递归删除；不产生 `.old-<ts>` 路径

### Requirement: CLI `skill info` 子命令

CLI SHALL 在 `soulkiller skill info <slug>` 下显示该 slug 的详细安装状态，包括本地版本、catalog 最新版本、每个 (target, scope) 的绝对路径与状态徽章、是否存在 `runtime/bin/` 等废弃结构。`--json` 切换为机器可读输出。

#### Scenario: 完整信息展示

- **WHEN** 用户执行 `soulkiller skill info fate-zero`
- **THEN** stdout 包含本地版本、catalog 版本、每个 (target, scope) 的绝对路径和状态、`hasLegacyRuntimeBin` 警告（若 true）

#### Scenario: JSON 输出

- **WHEN** 用户执行 `soulkiller skill info fate-zero --json`
- **THEN** stdout SHALL 是合法 JSON：`{ "slug": string, "installs": InstallRecord[], "catalog": CatalogEntry | null, "update_status": UpdateStatus }`

### Requirement: REPL `/install` 双 Tab 容器

REPL `/install` 命令 SHALL 以 Tab 容器为顶层 UI，包含 `Available`（可装）与 `Installed`（已装）两个视图。用户 SHALL 能用 `Tab` / `Shift-Tab` 切换；Esc 在 Tab 层退出命令，在子流里先回到 Tab 层。

#### Scenario: 默认进入 Available Tab

- **WHEN** 用户输入 `/install`
- **THEN** loading 完成后进入 Available tab；该 tab 内容为现有的 pick-skills 步骤

#### Scenario: 切换到 Installed Tab

- **WHEN** 用户按 Tab
- **THEN** 视图切换为 Installed tab，列出已装 skill（含当前版本、最新版本、覆盖 target 徽章）

#### Scenario: Esc 语义

- **WHEN** 用户在 Installed tab 的 action 菜单里按 Esc
- **THEN** 退回到 Installed tab 列表；再按一次 Esc 退出 `/install` 命令

### Requirement: REPL Installed Tab 操作菜单

在 Installed tab 选中一条 skill 后按 Enter，REPL SHALL 弹出 action 菜单，选项至少包含：`Update to <new-version>`（仅在有新版时出现）、`Install to other targets`（仅在有未覆盖 target 时出现）、`Details`、`Uninstall`、`← Back`。

#### Scenario: Update 动作

- **WHEN** 用户选择 `Update to <new>`
- **THEN** REPL 调用底层 `update` 路径（等价 `skill update <slug>`）；进度面板展示下载/安装；完成后回到 Installed 列表，状态刷新为 up-to-date

#### Scenario: 追装到其他 target

- **WHEN** 用户选择 `Install to other targets`
- **THEN** REPL 进入 target 多选子流；完成后等价 `skill install <slug> --to <new-targets>`；选过的 target 已勾选且禁用

#### Scenario: Uninstall 二次确认

- **WHEN** 用户选择 `Uninstall`
- **THEN** REPL SHALL 弹出二次确认对话框，显示目标路径与备份位置；`Y / Enter` 执行，`N / Esc` 取消

#### Scenario: Details 查看

- **WHEN** 用户选择 `Details`
- **THEN** REPL 展示该 skill 的 SKILL.md 首屏（front-matter + 前若干行描述）和安装元信息

### Requirement: REPL Available Tab 过滤

REPL `/install` 的 Available Tab SHALL 标注每条 catalog skill 的本地安装状态：完全未装显示无徽章；部分 target 已装显示 `[追装]`；所有 target 已装且均为最新版显示 `[✓ all]`；所有 target 已装但至少一条可升级显示 `[update available]` 并直接链接到 Installed tab 的 Update action。

#### Scenario: 未装 skill

- **WHEN** catalog 条目在本地任何 target 下都未装
- **THEN** 该行无徽章；勾选后进入 pick-targets 正常流

#### Scenario: 部分 target 已装

- **WHEN** 该 slug 已装在 claude-code，但 codex 未装
- **THEN** 该行显示 `[追装]` 徽章；勾选后的 pick-targets 步骤 SHALL 预勾选 codex、禁用已装的 claude-code（或以徽章标注"已装"）

#### Scenario: 全部已装且最新

- **WHEN** 该 slug 在所有已选 target 下都已装且版本与 catalog 相同
- **THEN** 该行显示 `[✓ all]` 徽章；勾选会被忽略并弹 toast 提示转到 Installed tab

### Requirement: 移除 `/install` UI 中的 `overwrite` 硬编码

REPL `/install` SHALL 不再通过 `useState(false)` 硬编码 `overwrite` 参数。覆盖行为由用户选择的 action 决定：`Update` → `overwrite=true`；`Install`（含追装）→ `overwrite=false` 且在冲突时报错提示使用 `Update`。

#### Scenario: Install 遇到已装冲突

- **WHEN** 用户通过 Available tab 尝试安装已存在同 target 的 skill
- **THEN** 底层 `installer` 抛 `ConflictError`；REPL SHALL 以 toast 提示"该 target 已装，使用 Installed tab 的 Update"；不执行覆盖

#### Scenario: Update 自动覆盖

- **WHEN** 用户在 Installed tab 触发 Update
- **THEN** 底层调用 `installer.atomicInstall({ overwrite: true })`；原目录 rename 为 `.old-<ts>`；写入成功后清理备份（或交给 `cleanupStaleOld`）
