# Acceptance CLI

## ADDED Requirements

### Requirement: verify 命令

系统 SHALL 提供 `bun run verify` 命令，执行指定 spec 文件或目录中的所有验收场景。

支持的调用方式：
- `bun run verify <spec-file.md>` — 执行单个 spec 文件的验收场景
- `bun run verify <spec-directory/>` — 递归执行目录下所有 spec.md 的验收场景
- `bun run verify --change <change-name>` — 执行该 change 涉及的所有 spec 的验收场景（从 change 的 specs 目录读取 capability 名称，映射到 `openspec/specs/<capability>/spec.md`）

#### Scenario: 验证单个 spec 文件

- **WHEN** 用户运行 `bun run verify openspec/specs/soul-conversation/spec.md`
- **THEN** 系统 SHALL 解析该文件中的所有 acceptance block
- **AND** SHALL 逐个执行验收场景
- **AND** SHALL 输出汇总结果

#### Scenario: 验证目录下所有 spec

- **WHEN** 用户运行 `bun run verify openspec/specs/`
- **THEN** 系统 SHALL 递归找到所有 `spec.md` 文件
- **AND** SHALL 执行所有包含 acceptance block 的场景
- **AND** SHALL 输出总体汇总

#### Scenario: 按 change 验证

- **WHEN** 用户运行 `bun run verify --change acceptance-testing-framework`
- **THEN** 系统 SHALL 读取 `openspec/changes/acceptance-testing-framework/specs/` 下的 capability 目录名
- **AND** SHALL 映射到 `openspec/specs/<capability>/spec.md`
- **AND** SHALL 执行这些 spec 的验收场景

#### Scenario: spec 文件无 acceptance block

- **WHEN** 指定的 spec 文件没有任何 acceptance block
- **THEN** 系统 SHALL 输出 "No acceptance scenarios found in <path>"
- **AND** 退出码 SHALL 为 0（不视为失败）

#### Scenario: 验收失败时的退出码

- **WHEN** 任一验收场景失败
- **THEN** 进程退出码 SHALL 为 1

#### Scenario: 全部通过时的退出码

- **WHEN** 所有验收场景都通过
- **THEN** 进程退出码 SHALL 为 0

### Requirement: diagnose 命令

系统 SHALL 提供 `bun run diagnose` 命令，用于快速健康检查和详细诊断。

支持的调用方式：
- `bun run diagnose` — 执行内置健康检查（boot + 基础命令可用性）
- `bun run diagnose --spec <spec-name>` — 执行指定 spec 的验收场景，verbose 模式
- `bun run diagnose --verbose` — 所有场景都输出详细的 timeline 和 screen dump

#### Scenario: 无参数健康检查

- **WHEN** 用户运行 `bun run diagnose`
- **THEN** 系统 SHALL 执行内置健康检查：
  - 启动 REPL，验证 `soul://void>` 提示符出现
  - 发送 `/help`，验证帮助信息输出
  - 发送 `/exit`，验证进程正常退出（exit code 0）
- **AND** SHALL 以 verbose 模式输出每步结果

#### Scenario: 指定 spec 诊断

- **WHEN** 用户运行 `bun run diagnose --spec soul-conversation`
- **THEN** 系统 SHALL 执行 `openspec/specs/soul-conversation/spec.md` 的所有验收场景
- **AND** SHALL 以 verbose 模式输出（每步都显示 timeline + screen）

#### Scenario: verbose 模式输出

- **WHEN** 以 verbose 模式执行
- **THEN** 每个步骤（包括通过的）SHALL 输出执行详情
- **AND** SHALL 显示每步的耗时和 terminal screen 快照

### Requirement: package.json scripts 集成

package.json SHALL 包含以下 scripts：
- `"verify": "bun src/acceptance/cli.ts verify"`
- `"diagnose": "bun src/acceptance/cli.ts diagnose"`

#### Scenario: 通过 bun run verify 执行

- **WHEN** 用户运行 `bun run verify openspec/specs/soul-conversation/spec.md`
- **THEN** SHALL 等同于直接运行 `bun src/acceptance/cli.ts verify openspec/specs/soul-conversation/spec.md`
