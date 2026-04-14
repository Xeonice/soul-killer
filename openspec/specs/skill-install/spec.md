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
CLI SHALL 在目标路径已存在同名 skill 时提供三种行为：默认跳过（输出 skipped 并继续其他 target）；`--overwrite` 标志下覆盖；交互模式下弹出确认菜单（Overwrite / Skip / Cancel）。

#### Scenario: 默认跳过
- **WHEN** `~/.claude/skills/fate-zero/` 已存在，用户执行 `soulkiller skill install fate-zero --to claude-code`（无 `--overwrite`）
- **THEN** 该 target 输出 "skipped: already installed"，退出码非零

#### Scenario: 覆盖
- **WHEN** `~/.claude/skills/fate-zero/` 已存在，用户执行 `soulkiller skill install fate-zero --to claude-code --overwrite`
- **THEN** CLI 先删除旧目录再写入新版

#### Scenario: 原子性
- **WHEN** 安装过程中任一步骤失败（网络、校验、写盘）
- **THEN** CLI 不得在目标位置留下半成品；采用 temp dir + rename 原子切换策略

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
REPL `/install` 无参时 SHALL 进入 6 步向导：(1) 多选 skill（来自 catalog）；(2) 多选 target；(3) 若 target 含 claude-code/codex/opencode 则选 global/project scope；(4) 展示预览矩阵（每条 skill × 每个 target 的目标绝对路径 + 冲突提示）；(5) 并发下载 + 顺序安装 + 进度条；(6) 结果摘要（成功/失败/重试命令）。任何步骤可用 Esc 取消。

#### Scenario: 完整向导流程
- **WHEN** 用户在 REPL 输入 `/install`
- **THEN** 依次渲染 Step 1 到 Step 6，每步用 ink 组件交互

#### Scenario: 带 slug 参数跳步
- **WHEN** 用户在 REPL 输入 `/install fate-zero`
- **THEN** 跳过 Step 1，直接进入 Step 2（target 选择）

#### Scenario: Esc 取消
- **WHEN** 向导任一步骤用户按 Esc
- **THEN** 所有下载/写入操作回滚（若尚未开始则直接退出），返回 REPL 主界面

### Requirement: 结果摘要
CLI SHALL 在 `skill install` 完成后输出结构化摘要：每个 (slug, target) 组合一行，显示成功（✓ + engine_version）、失败（✗ + 原因 + 重试命令）、跳过（skipped + 原因）。非交互模式下摘要用 stdout 纯文本；REPL 下用 ink 组件渲染。

#### Scenario: 全部成功
- **WHEN** 所有 (slug, target) 都安装成功
- **THEN** 摘要行格式 `✓ <slug>  <target>  installed (engine v<N>)`，总计行 `N installed · 0 failed`，退出码 0

#### Scenario: 部分失败
- **WHEN** 4 个 (slug, target) 组合中 3 个成功 1 个失败
- **THEN** 摘要包含 3 行 `✓` 和 1 行 `✗ <slug>  <target>  FAILED: <reason>`；附加重试命令行 `Retry: soulkiller skill install <slug> --to <target>`；退出码非零
