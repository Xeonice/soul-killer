## Why

实现完 OpenSpec 需求后，缺少一个从 spec 直接到验证的闭环。目前验证只能靠手动执行或跑已有的固定 E2E 场景，无法在写 spec 时就定义可执行的验收条件，也无法让 AI agent 在实现后直接自动验证。

## What Changes

- 在 spec.md 的 Scenario 下引入 ` ```acceptance ` fenced block，用声明式 YAML 定义可执行的验收步骤
- 新增 acceptance parser，从 spec.md 中提取验收场景
- 新增 acceptance runner，读取 YAML 步骤并驱动现有 TestTerminal 执行
- 新增 acceptance reporter，输出验证结果（含失败时的 timeline + screen dump 诊断信息）
- 新增 CLI 入口：`bun run verify <spec-path>` 和 `bun run diagnose`
- DSL 指令集覆盖交互（send/send-key/wait）、断言（expect/not-expect/expect-file/expect-request）、环境（fixture/mock-llm/env）
- 扩展点设计：Step Executor 注册表、Fixture 注册表、Reporter 接口，支持后续演进

## Capabilities

### New Capabilities
- `acceptance-dsl`: 声明式验收 DSL 规范 — 定义 YAML 指令集语法、语义、环境声明和步骤执行规则
- `acceptance-runner`: 验收执行引擎 — 解析 spec.md 中的 acceptance block，驱动 TestTerminal 执行，输出诊断报告
- `acceptance-cli`: 验收 CLI 入口 — verify 和 diagnose 两个命令，支持按 spec / change / 全量执行

### Modified Capabilities
（无现有 spec 的需求变更）

## Impact

- **新增代码**: `src/acceptance/` 目录（parser、runner、reporter、cli）
- **复用**: `tests/e2e/harness/test-terminal.ts`、`mock-llm-server.ts`、`fixtures/`（不修改，直接 import）
- **Spec 文件格式**: 所有 `openspec/specs/*/spec.md` 可选添加 ` ```acceptance ` block（向后兼容，不添加也不影响现有流程）
- **package.json**: 新增 `verify` 和 `diagnose` scripts
- **依赖**: 新增 `yaml` 包用于解析（项目已有此依赖）
