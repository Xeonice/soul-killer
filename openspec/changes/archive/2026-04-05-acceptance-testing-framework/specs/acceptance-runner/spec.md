# Acceptance Runner

## ADDED Requirements

### Requirement: Spec 解析

Runner SHALL 从 spec.md 文件中提取所有 acceptance block，每个 block 关联到其所属的 `#### Scenario: <name>`。解析结果为 `AcceptanceScenario[]`，每个元素包含场景名称、源文件路径、行号、环境声明和步骤列表。

#### Scenario: 解析包含多个 acceptance block 的 spec

- **WHEN** spec.md 包含 3 个 Scenario，其中 2 个有 acceptance block
- **THEN** parser SHALL 返回 2 个 AcceptanceScenario 对象
- **AND** 每个对象的 name SHALL 匹配对应 Scenario 标题

#### Scenario: 解析嵌套在 Requirement 下的 Scenario

- **WHEN** acceptance block 位于 `### Requirement` > `#### Scenario` 层级下
- **THEN** parser SHALL 正确关联场景名称（从最近的 `#### Scenario:` 提取）

### Requirement: 场景执行生命周期

Runner 执行每个 AcceptanceScenario 时 SHALL 遵循以下生命周期：

1. 创建隔离的 TestHome（`createTestHome()`）
2. 根据 `fixture` 声明调用对应 fixture 工厂函数
3. 如果 `mock-llm` 声明存在，启动 MockLLMServer
4. 创建 TestTerminal 实例
5. 顺序执行 steps 列表中的每个步骤
6. 任一步骤失败时，立即停止后续步骤，记录失败诊断
7. 无论成功失败，kill terminal、stop mock server、cleanup test home

#### Scenario: 正常执行全部步骤

- **WHEN** 所有步骤都成功
- **THEN** 场景 SHALL 标记为 pass
- **AND** SHALL 记录总执行时间

#### Scenario: 中途步骤失败

- **WHEN** 第 3 步失败（如 expect 超时）
- **THEN** 第 4 步及后续步骤 SHALL 不被执行
- **AND** 场景 SHALL 标记为 fail
- **AND** SHALL 记录失败步骤的索引、描述、错误信息

#### Scenario: 资源清理

- **WHEN** 场景执行完成（无论成功或失败）
- **THEN** TestTerminal SHALL 被 kill
- **AND** MockLLMServer（如果启动了）SHALL 被 stop
- **AND** TestHome 临时目录 SHALL 被删除

### Requirement: Fixture 注册表

Runner SHALL 维护一个 fixture 注册表，将 acceptance YAML 中的 `fixture` 值映射到具体的工厂函数。

| fixture 值 | 工厂函数 |
|---|---|
| `void` | 不额外操作（仅 createTestHome） |
| `bare-soul` | `createBareSoul(homeDir, soulName, opts)` |
| `distilled-soul` | `createDistilledSoul(homeDir, soulName, persona)` |
| `evolved-soul` | `createEvolvedSoul(homeDir, soulName, opts)` |

#### Scenario: 使用 evolved-soul fixture

- **WHEN** acceptance 声明 `fixture: evolved-soul`、`soul-name: alice`
- **THEN** runner SHALL 调用 `createTestHome()` 后调用 `createEvolvedSoul(homeDir, "alice")`
- **AND** TestTerminal SHALL 使用该 homeDir 启动

#### Scenario: 未知 fixture 值

- **WHEN** acceptance 声明 `fixture: unknown-type`
- **THEN** runner SHALL 报告 UNKNOWN_FIXTURE 错误并跳过该场景

### Requirement: 失败诊断输出

当步骤失败时，Runner SHALL 通过 Reporter 接口输出以下诊断信息：

- 失败步骤描述（指令类型 + 参数）
- 期望的 pattern 或条件
- Terminal screen dump（最后 15 行，strip ANSI）
- Timeline（最后 10 条事件）
- Buffer tail（最后 500 字符，strip ANSI）

#### Scenario: expect 超时时的诊断

- **WHEN** `expect: "SOUL NOT FOUND"` 步骤超时
- **THEN** 诊断输出 SHALL 包含：
  - `step 3 failed: expect "SOUL NOT FOUND"`
  - `timeout: 10000ms`
  - Screen dump 显示终端最后渲染状态
  - Timeline 显示最近的 PTY 数据事件

### Requirement: Reporter 接口

Runner SHALL 通过 Reporter 接口输出事件，而非直接 console.log。Reporter 接口包含以下回调：

- `onSuiteStart(specPath, scenarioCount)` — spec 文件开始执行
- `onScenarioStart(name)` — 场景开始
- `onStepPass(step, elapsed)` — 步骤通过
- `onStepFail(step, error, diagnosticContext)` — 步骤失败
- `onScenarioEnd(name, passed, elapsed)` — 场景结束
- `onSuiteEnd(passed, failed, total)` — spec 文件全部场景结束

Phase 0 SHALL 实现 `ConsoleReporter`。

#### Scenario: ConsoleReporter 正常输出

- **WHEN** 所有场景都通过
- **THEN** 输出 SHALL 包含每个场景的名称和耗时
- **AND** 末尾 SHALL 显示 "Result: N/N passed"

#### Scenario: ConsoleReporter 失败输出

- **WHEN** 某个场景失败
- **THEN** 输出 SHALL 包含失败场景的诊断信息（screen + timeline）
- **AND** 通过的场景 SHALL 只显示名称和耗时（不输出诊断）
