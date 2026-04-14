## MODIFIED Requirements

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

### Requirement: lint 规则

#### Scenario: 检测安装引导分支

- **WHEN** lint SKILL.md 模板
- **THEN** SHALL 检查 Phase -1 存在 `command not found` 分支 + AskUserQuestion 安装引导块（由新规则 `PHASE_MINUS_ONE_INSTALL_GUIDE_PRESENT` 承担）
- **AND** SHALL NOT 再强制检查 `soulkiller runtime doctor` 字面量存在性

#### Scenario: 检测 apply 调用

- **WHEN** lint SKILL.md 模板
- **THEN** SHALL 继续检测 `soulkiller runtime apply` 存在性（规则 `STATE_APPLY_PRESENT` 不变）

## REMOVED Requirements

### Requirement: 旧 lint 规则 PHASE_0_DOCTOR_PRESENT

**Reason**: Phase -1 Step 0 已从模板移除，该规则的检查对象不再存在
**Migration**: 由新规则 `PHASE_MINUS_ONE_INSTALL_GUIDE_PRESENT` 替代，检查 Phase -1 的 command-not-found 安装引导分支
