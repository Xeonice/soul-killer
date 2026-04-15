## ADDED Requirements

### Requirement: CLI 命令形状
CLI SHALL 在 `soulkiller skill install` 下提供如下命令签名：`install <slug|url|path> [--to <target>]... [--scope global|project] [--overwrite] [--catalog <url>]`；其中 `<slug>` 指 catalog 中的 slug，`<url>` 指远端 `.skill` 直链，`<path>` 指本地 `.skill` 文件路径。`--to` 可重复以多目标安装。未提供 `--scope` 时默认 `global`。`--all` 替代单个 slug 时安装 catalog 中所有 skill。

#### Scenario: 单目标安装
- **WHEN** 用户执行 `soulkiller skill install fate-zero --to claude-code`
- **THEN** CLI 从 catalog 拉取 fate-zero 条目，下载 `.skill`，校验 sha256，解压并剥离内层包装目录，写入 `~/.claude/skills/fate-zero/`

#### Scenario: 多目标同时安装
- **WHEN** 用户执行 `soulkiller skill install fate-zero --to claude-code --to codex --to openclaw`
- **THEN** CLI 下载一次 `.skill` 到临时目录，然后分别拷贝到 `~/.claude/skills/` / `~/.agents/skills/` / `~/.openclaw/workspace/skills/`

#### Scenario: 项目作用域
- **WHEN** 用户在 `/home/user/proj/` 执行 `soulkiller skill install fate-zero --to claude-code --scope project`
- **THEN** CLI 写入 `/home/user/proj/.claude/skills/fate-zero/`，不影响 `~/.claude/skills/`

#### Scenario: 批量安装所有 catalog skill
- **WHEN** 用户执行 `soulkiller skill install --all --to claude-code`
- **THEN** CLI 拉 catalog，对每条 skill 执行下载 + 校验 + 安装；任一失败不阻塞其他 skill 继续安装；结果摘要列出每条 skill 的成功/失败

#### Scenario: 本地 .skill 文件安装
- **WHEN** 用户执行 `soulkiller skill install /path/to/local.skill --to claude-code`
- **THEN** CLI 跳过 catalog 与网络，直接读本地文件，解内嵌 `soulkiller.json` 校验 engine_version，完成后安装

#### Scenario: 任意 URL 安装
- **WHEN** 用户执行 `soulkiller skill install https://example.com/custom.skill --to claude-code`
- **THEN** CLI 下载该 URL 的内容（不做 catalog sha256 校验，因为非 catalog 来源），解内嵌 `soulkiller.json` 做 engine_version 检查

### Requirement: 目标目录解析
CLI SHALL 将 `(target, scope)` 组合解析为具体文件系统路径，支持 Windows / Linux / macOS 三端。`os.homedir()` 与 `path.join` 必须被用来构造路径，不得硬编码分隔符。

#### Scenario: claude-code 全局路径
- **WHEN** target = claude-code, scope = global
- **THEN** 目标路径 = `<os.homedir()>/.claude/skills/`，在 Windows 上解析为 `C:\Users\<user>\.claude\skills\`，在 Unix 上解析为 `/home/<user>/.claude/skills/` 或 `/Users/<user>/.claude/skills/`

#### Scenario: codex 全局路径
- **WHEN** target = codex, scope = global
- **THEN** 目标路径 = `<os.homedir()>/.agents/skills/`

#### Scenario: opencode 全局路径
- **WHEN** target = opencode, scope = global
- **THEN** 目标路径 = `<os.homedir()>/.config/opencode/skills/`

#### Scenario: openclaw 全局路径
- **WHEN** target = openclaw, scope = global
- **THEN** 目标路径 = `<os.homedir()>/.openclaw/workspace/skills/`

#### Scenario: claude-code 项目路径
- **WHEN** target = claude-code, scope = project
- **THEN** 目标路径 = `<process.cwd()>/.claude/skills/`

#### Scenario: openclaw 不支持项目作用域
- **WHEN** target = openclaw, scope = project
- **THEN** CLI 返回错误 "openclaw does not support project scope"，退出码非零

### Requirement: cwd == $HOME 警告
CLI SHALL 在 `--scope project` 且 `process.cwd() === os.homedir()` 时显式警告用户，该 project 路径与 global 路径等价，并要求二次确认才继续。

#### Scenario: 用户在 $HOME 执行 project scope 安装
- **WHEN** `process.cwd() === os.homedir()` 且用户执行 `soulkiller skill install fate-zero --to claude-code --scope project`
- **THEN** CLI 打印警告 "cwd is $HOME — project scope and global scope resolve to the same directory"
- **AND** 在 TTY 下交互确认（Y/n）；非 TTY 下 abort 并要求 `--scope global` 或显式 `--force`

### Requirement: 内层包装目录自动剥离
CLI SHALL 在解包 `.skill` 档案后检测 root 结构：若 root 只有单一子目录且其中存在 `SKILL.md`，则 strip 该层子目录后写入目标路径；否则保留原结构。

#### Scenario: 带包装目录的 .skill
- **WHEN** 解包后 root 包含 `fate-zero/` 单一目录，且 `fate-zero/SKILL.md` 存在
- **THEN** 写入目标时 strip 掉 `fate-zero/` 一层，目标路径下直接是 `SKILL.md` / `souls/` / 等

#### Scenario: 已平铺的 .skill
- **WHEN** 解包后 root 直接包含 `SKILL.md`
- **THEN** 原样写入，不 strip

#### Scenario: 结构复杂不 strip
- **WHEN** 解包后 root 有多个顶级文件或目录（如 `SKILL.md` + `souls/` + `world/` 都在 root）
- **THEN** 原样写入

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

### Requirement: sha256 校验
CLI SHALL 在通过 slug 从 catalog 安装时强制校验下载内容的 sha256 与 catalog 条目匹配；不匹配则 abort 并保留错误信息。

#### Scenario: sha256 匹配
- **WHEN** 下载完成后计算 sha256 与 catalog 一致
- **THEN** 继续安装流程

#### Scenario: sha256 不匹配
- **WHEN** 计算得到 sha256 与 catalog 不一致
- **THEN** CLI abort，打印 "checksum mismatch: expected <a>, got <b>"，不写入目标路径，退出码非零

### Requirement: engine_version 兼容检查
CLI SHALL 在安装前读取 skill 的 `soulkiller.json.engine_version`（catalog 或档案内嵌），与本机 soulkiller 支持的 `CURRENT_ENGINE_VERSION` 比较；超本机支持版本则 abort 并提示用户使用 `/upgrade` 或 `soulkiller --update` 升级二进制。

#### Scenario: 兼容
- **WHEN** engine_version ≤ CURRENT_ENGINE_VERSION
- **THEN** 安装继续

#### Scenario: 超本机支持
- **WHEN** engine_version > CURRENT_ENGINE_VERSION
- **THEN** CLI abort，错误文案：`<slug> requires engine_version ≥ N; current soulkiller supports ≤ M. Run /upgrade (REPL) or soulkiller --update (CLI) first.`

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

### Requirement: 结果摘要
CLI SHALL 在 `skill install` 完成后输出结构化摘要：每个 (slug, target) 组合一行，显示成功（✓ + engine_version）、失败（✗ + 原因 + 重试命令）、跳过（skipped + 原因）。非交互模式下摘要用 stdout 纯文本；REPL 下用 ink 组件渲染。

#### Scenario: 全部成功
- **WHEN** 所有 (slug, target) 都安装成功
- **THEN** 摘要行格式 `✓ <slug>  <target>  installed (engine v<N>)`，总计行 `N installed · 0 failed`，退出码 0

#### Scenario: 部分失败
- **WHEN** 4 个 (slug, target) 组合中 3 个成功 1 个失败
- **THEN** 摘要包含 3 行 `✓` 和 1 行 `✗ <slug>  <target>  FAILED: <reason>`；附加重试命令行 `Retry: soulkiller skill install <slug> --to <target>`；退出码非零
