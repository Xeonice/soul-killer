## ADDED Requirements

### Requirement: soulkiller runtime 子命令

soulkiller 二进制 SHALL 支持 `soulkiller runtime <subcommand> [args...]` 调用方式，作为 skill state CLI 的跨平台入口。

#### Scenario: 正常执行 state 子命令

- **WHEN** 在 Claude Code skill 环境中（`CLAUDE_SKILL_DIR` 已设定）执行 `soulkiller runtime apply <script-id> <scene-id> <choice-id>`
- **THEN** SHALL spawn 自身（`process.execPath` + `BUN_BE_BUN=1`）执行 `$CLAUDE_SKILL_DIR/runtime/lib/main.ts apply <script-id> <scene-id> <choice-id>`
- **AND** stdout/stderr SHALL 透传给调用者
- **AND** exit code SHALL 与 main.ts 的返回值一致

#### Scenario: CLAUDE_SKILL_DIR 未设定

- **WHEN** 在非 skill 环境中执行 `soulkiller runtime <subcommand>`
- **THEN** SHALL 输出错误信息到 stderr 并以非零 exit code 退出

#### Scenario: runtime/lib/main.ts 不存在

- **WHEN** skill archive 缺少 `runtime/lib/main.ts`
- **THEN** SHALL 输出错误信息到 stderr 并以非零 exit code 退出

### Requirement: doctor 子命令输出

`soulkiller runtime doctor` SHALL 输出结构化的 `KEY: value` 格式。

#### Scenario: 正常环境

- **WHEN** 执行 `soulkiller runtime doctor`
- **THEN** stdout SHALL 包含 `STATUS: OK`、`SOULKILLER_VERSION`、`BUN_VERSION`、`PLATFORM` 四个字段
- **AND** PLATFORM SHALL 使用 `process.platform-process.arch` 格式（如 `win32-x64`、`darwin-arm64`）

### Requirement: 跨平台 tree server 进程管理

#### Scenario: Unix 上终止 tree server

- **WHEN** 在 macOS/Linux 上执行 `soulkiller runtime tree --stop`
- **THEN** SHALL 使用 `process.kill(pid, 'SIGTERM')` 终止 tree server 进程

#### Scenario: Windows 上终止 tree server

- **WHEN** 在 Windows 上执行 `soulkiller runtime tree --stop`
- **THEN** SHALL 使用 `taskkill /pid <pid> /f /t` 终止 tree server 进程

#### Scenario: tree server 启动

- **WHEN** 执行 `soulkiller runtime tree <script-id>`
- **THEN** SHALL 使用 `spawn(process.execPath, [tree-server.ts], { env: { BUN_BE_BUN: '1' }, detached: true })` 启动 tree server
- **AND** 不再依赖 PATH 中的 `bun` 命令

## MODIFIED Requirements

### Requirement: SKILL.md state CLI 调用方式

所有 SKILL.md 模板中的 state CLI 调用 SHALL 使用 `soulkiller runtime <subcommand>` 格式。

#### Scenario: 替代 bash wrapper

- **WHEN** 生成 SKILL.md 模板
- **THEN** 所有 state CLI 调用 SHALL 为 `soulkiller runtime <subcommand> [args...]`
- **AND** SHALL NOT 出现 `bash runtime/bin/state` 或 `pwsh runtime/bin/state.ps1`

### Requirement: Phase -1 Step 0 健康检查

#### Scenario: soulkiller 已安装

- **WHEN** `soulkiller runtime doctor` 返回 `STATUS: OK`
- **THEN** SHALL 继续到 Step -1.1

#### Scenario: soulkiller 未安装

- **WHEN** `soulkiller runtime doctor` 命令不存在
- **THEN** SHALL 通过 AskUserQuestion 展示安装指引
- **AND** 指引 SHALL 包含 macOS/Linux（curl install.sh）和 Windows（irm install.ps1）两种安装方式

### Requirement: Platform Notice

- **WHEN** 生成 SKILL.md
- **THEN** 平台支持列表 SHALL 包含 macOS、Linux、Windows
- **AND** SHALL NOT 再将 Windows 原生 shell 列为不支持

### Requirement: skill archive 打包

#### Scenario: 不再打包 shell wrapper

- **WHEN** packager 构建 skill archive
- **THEN** SHALL NOT 打包 `runtime/bin/state`（bash wrapper）
- **AND** SHALL NOT 打包 `runtime/bin/doctor.sh`
- **AND** SHALL 继续打包 `runtime/lib/*.ts`

### Requirement: lint 规则

#### Scenario: 检测 doctor 调用

- **WHEN** lint SKILL.md 模板
- **THEN** SHALL 检测 `soulkiller runtime doctor` 存在性（替代 `runtime/bin/state doctor`）

#### Scenario: 检测 apply 调用

- **WHEN** lint SKILL.md 模板
- **THEN** SHALL 检测 `soulkiller runtime apply` 存在性（替代 `runtime/bin/state apply`）

## REMOVED Requirements

### Requirement: bash wrapper (state.sh)

- `runtime/bin/state` bash wrapper SHALL be removed from the codebase and archive

### Requirement: doctor.sh POSIX health check

- `runtime/bin/doctor.sh` SHALL be removed from the codebase and archive

### Requirement: 独立 bun bootstrap 流程

- Phase -1 的 BUN_MISSING / BUN_OUTDATED 安装引导 SHALL be removed
- PLATFORM_UNSUPPORTED (windows-native) 硬拒逻辑 SHALL be removed
