## Why

README 当前教用户用一串 `curl | unzip | mkdir | mv` 的 bash 脚本装预制 `.skill` 档案，且每个目标 CLI（Claude Code 全局 / Claude Code 项目 / OpenClaw）都要重复一遍。这个方案有四个硬伤：

1. **Windows 不可用** —— `mktemp`、`unzip`、`rm -rf` 都是 POSIX 工具，PowerShell 需要完全不同的脚本
2. **覆盖面窄** —— 只写了 Claude Code / OpenClaw 两家；今年 Codex CLI 和 opencode 也都采用了 `<name>/SKILL.md` 目录约定，用户有跨工具安装需求但没现成脚本
3. **破坏了启动器身份** —— `v0.4.0` 刚把 README 重组为「soulkiller 是本地启动器」，装 skill 却绕开 CLI 用 bash，语义断裂
4. **zip/tar 生态分裂** —— 项目里 `src/cli/updater.ts` 和 `src/export/pack/unpacker.ts` 仍 shell-out `tar` / `powershell Expand-Archive`，平台分支代码多、Windows 老版本行为不稳定；应该一次性替换成纯 TS 方案

此外 `catalog.json` 能让 CI 自动收集远端可装 skill 列表，CLI 客户端就能列目录、校验 slug、sha256 验签。

## What Changes

**新增命令**
- `soulkiller skill install <slug|url|path> [--to <target>]... [--scope global|project] [--overwrite] [--catalog <url>]` —— 非交互装 skill；可多个 `--to` 同时装多目标
- `soulkiller skill install`（无参）—— 进入 6 步交互向导（选 skill → 选 target → 选 scope → 预览矩阵 → 下载安装 → 结果摘要）
- `soulkiller skill catalog [--json]` —— 拉远端 catalog.json 列出所有可装 skill
- REPL `/install` —— 等价于 CLI `skill install`，无参进向导
- REPL `/upgrade` —— 二进制自更（等价 `soulkiller --update`），带确认界面

**扩展命令**
- `soulkiller skill list` —— 从单目录（`~/.claude/skills/`）扩展到扫 4 个全局 + 3 个项目目录，合并列显示
- `soulkiller skill upgrade` —— 同步扩展到跨目录；同一 slug 在多目标中都升一遍

**基础设施**
- 新增 `nanotar` 依赖（~2KB 纯 TS tar 解包），配合已有 `fflate` 覆盖 zip/gzip，**彻底移除** `src/cli/updater.ts` 与 `src/export/pack/unpacker.ts` 里所有 `execSync tar`/`powershell Expand-Archive` 调用
- CI 构建 `.skill` 档案时自动生成 `catalog.json`，随档案上传 Worker（新 endpoint `/examples/catalog.json`）

**目标目录矩阵**

| target | Global | Project |
|---|---|---|
| `claude-code` | `~/.claude/skills/` | `<cwd>/.claude/skills/` |
| `codex` | `~/.agents/skills/` | `<cwd>/.agents/skills/` |
| `opencode` | `~/.config/opencode/skills/` | `<cwd>/.opencode/skills/` |
| `openclaw` | `~/.openclaw/workspace/skills/` | —（无项目级概念） |

注：opencode 同时读 `~/.claude/skills/` 和 `~/.agents/skills/`，装到这两路其实也能跑，但保留 `opencode` 作为独立 target 方便只用 opencode 的用户精准落位。Cursor 无 `<name>/SKILL.md` 加载约定，本次不支持（`--help` 明示）。

**README**
- 删掉三国 bash 脚本块（全局/项目/OpenClaw）
- 改为一条 `soulkiller skill install --all --to claude-code` 示例
- 保留一行 fallback 说明：「未装 soulkiller 可先走自更新脚本装 CLI，再用 CLI 装 skill」

## Capabilities

### New Capabilities
- `skill-install`: `soulkiller skill install` 命令（CLI + REPL 向导）、catalog 拉取与校验、多目标多作用域安装、sha256 / engine_version 校验、自动剥离内层包装目录。
- `skill-catalog`: Worker `/examples/catalog.json` 端点约定 + CI 生成流水线；catalog.json schema 与字段语义。
- `repl-upgrade`: REPL `/upgrade` 命令——封装现有 `runUpdate()` 的交互入口，确认界面 + 升完提示重启。

### Modified Capabilities
- `skill-upgrade`: 从只扫 `~/.claude/skills/` 扩展到扫 4 全局 + 3 项目目录；同一 slug 在多处都升。
- `pack-format` / `soul-package`: 解压路径从 shell-out `tar` 切成 fflate gunzip + nanotar（纯 TS，跨平台一致）。
- `self-update`: Unix `tar -xzf` 与 Windows `powershell Expand-Archive` 两条 shell 路径都替换为 fflate/nanotar；行为不变但无平台分支。

## Impact

**新增依赖**
- `nanotar` (~2KB) — 纯 TS tar 解包

**代码改动**
- `src/cli/skill-manager.ts` — 新增 install/catalog 子命令，扩展 list/upgrade 的目录范围
- `src/cli/skill-install/`（新目录）— install 流水线：catalog client、downloader、extractor、target resolver、conflict handler
- `src/cli/commands/install.tsx`（新）— REPL `/install` 向导组件
- `src/cli/commands/upgrade.tsx`（新）— REPL `/upgrade` 确认组件
- `src/cli/command-registry.ts` — 注册 `/install` + `/upgrade`
- `src/cli/updater.ts` — 替换 tar/powershell 调用为 fflate/nanotar
- `src/export/pack/unpacker.ts` — 同上
- `src/index.tsx` — `skill install` / `skill catalog` 子命令派发
- `README.md` / `README.en.md` / `README.ja.md` — 删 bash 脚本，换 CLI 示例
- `.github/workflows/` 或 `scripts/build-catalog.ts` — CI 生成 `catalog.json`

**新接口**
- Worker `/examples/catalog.json` (JSON)
- 环境变量 `SOULKILLER_CATALOG_URL`（覆盖默认 URL）

**向后兼容**
- 所有现有命令行为保持（`skill list` 输出列增加但不减；`skill upgrade` 行为对单目标场景等价）
- 旧 `.soul.pack` / `.world.pack` 仍能解（格式不变，只替换解压实现）
- 已装在 `~/.claude/skills/` 的 skill 不受影响；`skill list` 仍能识别

**破坏性**
- 无。所有改动皆为新增能力或等价替换。
