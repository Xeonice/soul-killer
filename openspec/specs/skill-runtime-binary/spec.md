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

`soulkiller runtime doctor` SHALL 保留作为兼容入口（老 skill 归档仍可调用），但 MUST 标记为 deprecated。stdout 输出 MUST 与历史协议一致以避免老 skill 的 LLM parser 走异常分支；stderr MUST 追加一行 deprecation 提示。

#### Scenario: 兼容调用

- **WHEN** 执行 `soulkiller runtime doctor`
- **THEN** stdout SHALL 包含 `STATUS: OK`、`SOULKILLER_VERSION`、`BUN_VERSION`、`PLATFORM` 四个字段（与历史协议一致）
- **AND** PLATFORM SHALL 使用 `process.platform-process.arch` 格式（如 `win32-x64`、`darwin-arm64`）
- **AND** exit code SHALL 为 0

#### Scenario: 输出 deprecation 提示

- **WHEN** 执行 `soulkiller runtime doctor`
- **THEN** stderr SHALL 输出一行 deprecation notice，指向 `soulkiller doctor` 顶层命令
- **AND** stderr 的 deprecation notice SHALL NOT 影响 stdout 的 `KEY: value` 协议

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

Phase -1 流程 SHALL NOT 再包含独立的"Step 0 Runtime Health Check"章节。soulkiller 是否安装的检测 SHALL 由首条实际 `soulkiller runtime <xxx>` 调用的 command-not-found 信号承担，并由 Phase -1 明文约定的安装引导分支兜底。

#### Scenario: soulkiller 已安装

- **WHEN** 生成的 SKILL.md 进入 Phase -1
- **THEN** 首条可执行步骤 SHALL 是 Step -1.1（列出已有剧本），而非独立 Step 0
- **AND** SHALL NOT 包含字面量 `soulkiller runtime doctor` 作为必执行步骤

#### Scenario: soulkiller 未安装

- **WHEN** Phase -1 中任一 `soulkiller runtime <xxx>` 调用返回 shell `command not found`（或等价错误）
- **THEN** SHALL 通过 AskUserQuestion 展示安装指引
- **AND** 指引 SHALL 包含 macOS/Linux（curl install.sh）和 Windows（irm install.ps1）两种安装方式
- **AND** 用户选择"已安装"后 SHALL 重试触发命令；用户选择"取消"后 SHALL 进入 read-only 模式

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

#### Scenario: 检测安装引导分支

- **WHEN** lint SKILL.md 模板
- **THEN** SHALL 检查 Phase -1 存在 `command not found` 分支 + AskUserQuestion 安装引导块（由新规则 `PHASE_MINUS_ONE_INSTALL_GUIDE_PRESENT` 承担）
- **AND** SHALL NOT 再强制检查 `soulkiller runtime doctor` 字面量存在性

#### Scenario: 检测 apply 调用

- **WHEN** lint SKILL.md 模板
- **THEN** SHALL 继续检测 `soulkiller runtime apply` 存在性（规则 `STATE_APPLY_PRESENT` 不变）

## REMOVED Requirements

### Requirement: bash wrapper (state.sh)

- `runtime/bin/state` bash wrapper SHALL be removed from the codebase and archive

### Requirement: doctor.sh POSIX health check

- `runtime/bin/doctor.sh` SHALL be removed from the codebase and archive

### Requirement: 独立 bun bootstrap 流程

- Phase -1 的 BUN_MISSING / BUN_OUTDATED 安装引导 SHALL be removed
- PLATFORM_UNSUPPORTED (windows-native) 硬拒逻辑 SHALL be removed
