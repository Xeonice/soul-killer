## ADDED Requirements

### Requirement: skill list 命令

`soulkiller skill list` SHALL 扫描 `~/.claude/skills/` 目录，识别 soulkiller 导出的 skill，显示名称、engine_version、soulkiller_version 和升级状态。

#### Scenario: 列出混合版本的 skill

- **WHEN** 已安装 skill 中有已迁移的（有 soulkiller.json）和未迁移的（无 soulkiller.json 但有 runtime/）
- **THEN** SHALL 列出所有 soulkiller skill，已迁移的显示版本号和状态（up to date / needs update），未迁移的显示 "needs migration"

#### Scenario: 无 soulkiller skill

- **WHEN** `~/.claude/skills/` 下没有 soulkiller 导出的 skill
- **THEN** SHALL 输出 "No soulkiller skills found"

### Requirement: skill upgrade 命令 — 常规升级

`soulkiller skill upgrade` SHALL 检测已安装 skill 的 engine_version，与当前二进制内嵌的版本比对，不同则覆盖更新 `runtime/engine.md` 并更新 `soulkiller.json`。

#### Scenario: engine_version 过期

- **WHEN** skill 的 engine_version 低于当前二进制内嵌版本
- **THEN** SHALL 覆盖 `runtime/engine.md` 为最新内容，更新 `soulkiller.json` 中的 engine_version 和 soulkiller_version

#### Scenario: 已是最新

- **WHEN** skill 的 engine_version 等于当前内嵌版本
- **THEN** SHALL 输出 "already up to date" 并跳过

#### Scenario: 指定 skill 名称

- **WHEN** 执行 `soulkiller skill upgrade three-kingdom`
- **THEN** SHALL 仅升级指定的 skill，不影响其他 skill

#### Scenario: --all 升级所有

- **WHEN** 执行 `soulkiller skill upgrade --all`
- **THEN** SHALL 升级所有需要更新的 soulkiller skill

### Requirement: skill upgrade 命令 — 首次迁移

对于无 `soulkiller.json` 的旧 skill，`soulkiller skill upgrade` SHALL 执行首次迁移：从源数据重建内容生成拆分后的文件。

#### Scenario: 旧 skill 迁移成功

- **WHEN** 旧 skill 有 story-spec.md 和 souls/ 目录
- **THEN** SHALL 生成新的 SKILL.md（内容 + 引导语）、runtime/engine.md、soulkiller.json，备份旧 SKILL.md 为 SKILL.md.bak

#### Scenario: 旧 skill 缺少 story-spec.md

- **WHEN** 旧 skill 没有 story-spec.md
- **THEN** SHALL 报错并跳过该 skill，保留旧 SKILL.md 不变

#### Scenario: 迁移时清理 runtime/lib/

- **WHEN** 旧 skill 存在 runtime/lib/ 目录
- **THEN** SHALL 删除 runtime/lib/ 目录（runtime.ts 已改为内嵌执行，不再需要）

### Requirement: engine_version 模板内容基线

`runtime/engine.md` 模板 SHALL 随 `engine_version` bump 同步更新内容。本次变更 SHALL 将模板中的 Phase -1 Step 0（Runtime Health Check）章节删除，并用 Step -1.1 作为 Phase -1 首个可执行步骤。

#### Scenario: 升级后 Phase -1 无 Step 0

- **WHEN** 用户对已安装的 skill 执行 `soulkiller skill upgrade`，且内嵌 `engine_version` 已 bump 到包含本次变更的版本
- **THEN** `runtime/engine.md` 中 SHALL NOT 再包含字面量 "Step 0: Runtime Health Check"
- **AND** SHALL NOT 再包含 `soulkiller runtime doctor` 作为必执行步骤

#### Scenario: 升级后仍有安装引导分支

- **WHEN** `soulkiller skill upgrade` 完成
- **THEN** 更新后的 `runtime/engine.md` SHALL 仍包含 Phase -1 的 `command not found` → AskUserQuestion 安装引导分支
- **AND** SHALL 通过 `PHASE_MINUS_ONE_INSTALL_GUIDE_PRESENT` lint 规则

### Requirement: 示例库同步

`examples/skills/*.skill` 仓库文件 SHALL 与当前 binary 内嵌的 `engine_version` 一致。

#### Scenario: 合入包含模板变更的 change 时

- **WHEN** 本次 change（或后续任何修改 `runtime/engine.md` 模板的 change）合入 main
- **THEN** `examples/skills/fate-zero.skill` / `three-kingdoms.skill` / `white-album-2.skill` SHALL 被重新生成并覆盖提交
- **AND** 新文件的 `soulkiller.json` 中 `engine_version` SHALL 与合入时 binary 内嵌版本一致

### Requirement: skill list 扫描范围
`soulkiller skill list` SHALL 扫描所有支持的 skill 安装目录——4 个全局路径（`~/.claude/skills/`、`~/.agents/skills/`、`~/.config/opencode/skills/`、`~/.openclaw/workspace/skills/`）与 3 个项目路径（`<cwd>/.claude/skills/`、`<cwd>/.agents/skills/`、`<cwd>/.opencode/skills/`）。每个 slug 合并为单行显示，`targets` 列以逗号分隔列出该 slug 出现的目标。

#### Scenario: 合并列显示
- **WHEN** fate-zero 同时装在 `~/.claude/skills/` 和 `~/.agents/skills/`
- **THEN** `skill list` 输出一行 `fate-zero  <engine>  <version>  up to date  claude-code,codex`，而非两行

#### Scenario: 项目目录扫描
- **WHEN** 用户在 `/home/user/proj/` 执行 `skill list`，且 `/home/user/proj/.claude/skills/foo/` 存在
- **THEN** 输出包含 `foo` 行，其 `targets` 列含 `claude-code-project`

#### Scenario: 版本漂移警告
- **WHEN** 同一 slug 在两个目录下的 `soulkiller.json.version` 不一致
- **THEN** `skill list` 对该行加 `⚠` 标记，并在附加行打印两处的具体版本，建议 `skill upgrade <slug>`

### Requirement: skill upgrade 跨目录行为
`soulkiller skill upgrade <slug>` SHALL 对该 slug 在所有扫描目录中的副本都执行升级；`skill upgrade --all` SHALL 对所有 slug 的所有副本升级。

#### Scenario: 单 slug 跨目录升级
- **WHEN** fate-zero 同时装在 `~/.claude/skills/` 和 `~/.agents/skills/`，用户执行 `skill upgrade fate-zero`
- **THEN** 两个目录下的 `runtime/engine.md` 都被刷新到 `CURRENT_ENGINE_VERSION`

#### Scenario: --all 全量升级
- **WHEN** 用户执行 `skill upgrade --all`
- **THEN** 遍历所有目录、所有 slug，凡 `needsUpdate` 或 `needsMigration` 的副本都升级一遍

#### Scenario: 失败隔离
- **WHEN** 升级过程中某目录写失败（权限 / 只读 FS）
- **THEN** 打印错误但不阻塞其他目录继续升级；结果摘要列出该失败条目
