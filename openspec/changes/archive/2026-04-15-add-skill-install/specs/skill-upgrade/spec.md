## MODIFIED Requirements

### Requirement: `skill list` 扫描范围
`soulkiller skill list` SHALL 扫描所有支持的 skill 安装目录——4 个全局路径（`~/.claude/skills/`、`~/.agents/skills/`、`~/.config/opencode/skills/`、`~/.openclaw/workspace/skills/`）与 3 个项目路径（`<cwd>/.claude/skills/`、`<cwd>/.agents/skills/`、`<cwd>/.opencode/skills/`）。每个 slug 合并为单行显示，`targets` 列以逗号分隔列出该 slug 出现的目标。

#### Scenario: 合并列显示
- **WHEN** fate-zero 同时装在 `~/.claude/skills/` 和 `~/.agents/skills/`
- **THEN** `skill list` 输出一行 `fate-zero  <engine>  <version>  up to date  claude-code,codex`，而非两行

#### Scenario: 项目目录扫描
- **WHEN** 用户在 `/home/user/proj/` 执行 `skill list`，且 `/home/user/proj/.claude/skills/foo/` 存在
- **THEN** 输出包含 `foo` 行，其 `targets` 列含 `claude-code-project`（或类似标注区分 global/project 的形式）

#### Scenario: 版本漂移警告
- **WHEN** 同一 slug 在两个目录下的 `soulkiller.json.version` 不一致
- **THEN** `skill list` 对该行加 `⚠` 标记，并在附加行打印两处的具体版本，建议 `skill upgrade <slug>`

### Requirement: `skill upgrade` 跨目录行为
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
