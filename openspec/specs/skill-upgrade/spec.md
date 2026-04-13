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
