## 1. 项目骨架

- [x] 1.1 创建 `acceptance/` 目录结构（parser.ts、runner.ts、reporter.ts、cli.ts、types.ts、executors.ts、fixtures.ts）
- [x] 1.2 在 package.json 中添加 `verify` 和 `diagnose` scripts

## 2. Parser — 从 spec.md 提取 acceptance block

- [x] 2.1 实现 `parseSpecFile(filePath): AcceptanceScenario[]`，用正则提取 ` ```acceptance ` fenced block 并关联 `#### Scenario: <name>`
- [x] 2.2 实现 YAML 解析 + schema 校验（必需字段 steps，可选字段 fixture/soul-name/persona/mock-llm/env/timeout），非法 YAML 报 PARSE_ERROR 含行号
- [x] 2.3 实现 timeout 格式解析（数字毫秒 / `30s` / `2m` 字符串 → 毫秒数）
- [x] 2.4 为 parser 编写单元测试（合法 block、无 block、非法 YAML、多 block、timeout 格式）

## 3. Step Executor 注册表 + 内置 Executor

- [x] 3.1 实现 executor 注册表（`Map<string, StepExecutor>`）和 ExecutionContext 类型定义
- [x] 3.2 实现交互类 executor：send、send-key、send-raw、wait、wait-prompt、wait-exit、sleep
- [x] 3.3 实现断言类 executor：expect、not-expect、expect-file（exists + contains）、expect-request
- [x] 3.4 实现单步 timeout 覆盖逻辑（步骤级 timeout 优先于全局 timeout）
- [x] 3.5 为每个 executor 编写单元测试（mock TestTerminal + MockLLMServer）

## 4. Fixture 注册表

- [x] 4.1 实现 fixture 注册表，映射 void/bare-soul/distilled-soul/evolved-soul 到现有 fixture 函数
- [x] 4.2 处理 soul-name 和 persona 参数传递
- [x] 4.3 处理未知 fixture 值的 UNKNOWN_FIXTURE 错误

## 5. Runner — 场景执行引擎

- [x] 5.1 实现 AcceptanceRunner 主循环：环境创建 → fixture → mock-llm → TestTerminal → 逐步执行 → 清理
- [x] 5.2 实现失败时立即停止后续步骤 + 收集诊断信息（screen dump、timeline、buffer tail）
- [x] 5.3 实现资源清理保证（try/finally：kill terminal、stop mock server、cleanup home）
- [x] 5.4 为 runner 编写集成测试（用一个简单的 spec.md fixture 验证端到端执行）

## 6. Reporter

- [x] 6.1 定义 Reporter 接口（onSuiteStart/onScenarioStart/onStepPass/onStepFail/onScenarioEnd/onSuiteEnd）
- [x] 6.2 实现 ConsoleReporter：正常模式（只输出场景级结果）和 verbose 模式（每步都输出）
- [x] 6.3 实现失败诊断��出格式（步骤描述 + ��望 + screen dump + timeline + buffer tail）

## 7. CLI 入口

- [x] 7.1 实现 `verify` 子命令：支持 spec 文件路径、目录路径、`--change <name>` 三种入口
- [x] 7.2 实现 `diagnose` 子命令：无参数健康检查（boot + /help + /exit）、`--spec <name>`、`--verbose`
- [x] 7.3 实现退出码逻辑（全部通过 → 0，任一失败 → 1，无场景 → 0）
- [x] 7.4 实现 `--change` 模式：从 change 的 specs 目录读取 capability 名 → 映射到 openspec/specs/<capability>/spec.md

## 8. 验证 — ���真实 spec 跑通

- [x] 8.1 选取 repl-shell spec，添加 4 个 acceptance block（Unknown Command、No Soul、Help、Exit）
- [x] 8.2 用 `bun run verify` 跑通，确认端到端流程正常（4/4 passed）
- [x] 8.3 用 `bun run diagnose` 跑通健康检查（1/1 passed）
