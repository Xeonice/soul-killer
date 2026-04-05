## Context

项目已有完整的多层测试体系（unit → component → integration → E2E），其中 E2E 层基于 `TestTerminal` 类提供真实 PTY 控制。但现有 E2E 是编程式的（TypeScript 代码），与 OpenSpec 的 spec.md 分离。开发者写完 spec 后无法直接验证实现是否符合需求，AI agent 也无法在实现后自动执行验收。

现有 E2E 基础设施：
- `TestTerminal`（331 行）：PTY 启动、send/waitFor/sendKey、timeline 调试、screen dump
- `MockLLMServer`（135 行）：OpenAI 兼容的 mock 服务器，支持流式/非流式
- `createTestHome`：隔离的 HOME 目录 + config.yaml
- `createBareSoul` / `createDistilledSoul` / `createEvolvedSoul`：预置 soul fixture

## Goals / Non-Goals

**Goals:**
- Spec 里的 Scenario 下可嵌入声明式验收条件（YAML），需求和验证放在一起
- 验收 runner 复用现有 TestTerminal + MockLLMServer，不重写底层
- 失败时输出足够的诊断信息（timeline + screen dump），AI agent 看到即可定位问题
- CLI 入口让 AI agent 或开发者一条命令即可执行验证
- 框架可演进：通过注册表机制，后续 phase 不需要重写核心

**Non-Goals:**
- Phase 0 不做并行执行、增量验证、CI reporter
- Phase 0 不做变量捕获、条件步骤、场景依赖、数据驱动
- 不替代现有 E2E 测试（bun:test scenarios），两者共存
- 不修改现有 TestTerminal / MockLLMServer / fixture 代码

## Decisions

### Decision 1: 验收条件嵌入 spec.md 而非独立文件

在 spec.md 的 `#### Scenario` 下方用 ` ```acceptance ` fenced block 嵌入 YAML。

**为什么不用独立的 acceptance.yaml？**
- 需求和验证紧挨着，review 时一眼对齐
- 避免两处不同步的问题
- Scenario 的 WHEN/THEN 自然语言描述是给人看的，acceptance block 是给机器执行的，两者互补

**格式选择 YAML：**
- 项目已有 YAML 基础（config.yaml、yaml 依赖）
- 表达力足够覆盖所有 DSL 指令
- 不需要自建 parser

### Decision 2: 在 TestTerminal 上包声明式 adapter，不重写底层

Runner 的核心职责是「YAML 步骤 → TestTerminal API 调用」的映射层。

```
acceptance YAML step        →   TestTerminal API
─────────────────────────────────────────────────
send: "hello"               →   terminal.send("hello")
send-key: tab               →   terminal.sendKey("tab")
send-raw: "/cr"             →   terminal.proc.terminal.write("/cr")
wait: "pattern"             →   terminal.waitFor(/pattern/, {since:'last'})
wait-prompt:                →   terminal.waitForPrompt()
expect: "pattern"           →   terminal.waitFor(/pattern/, {since:'last'})
not-expect: "pattern"       →   !regex.test(terminal.getBuffer())
wait-exit: 0                →   terminal.waitForExit() + assert code
expect-file: {path, exists} →   fs.existsSync(path.join(home, p))
expect-file: {path, contains} → fs.readFileSync(...).includes(s)
expect-request: {...}       →   mockServer.requests[index] assertions
sleep: 500                  →   await new Promise(r => setTimeout(r, 500))
```

**为什么不重写？**
- TestTerminal 已经很成熟（PTY 控制、timeline、screen dump 都有了）
- 声明式层只增加了约 200-300 行代码
- 修改 TestTerminal 会影响现有 10 个 E2E 场景的稳定性

### Decision 3: Step Executor 注册表实现可扩展性

```typescript
type StepExecutor = (
  step: StepDefinition,
  ctx: ExecutionContext,  // { terminal, mockServer, homeDir, vars }
) => Promise<StepResult>

const executors = new Map<string, StepExecutor>()
executors.set('send', sendExecutor)
executors.set('expect', expectExecutor)
// Phase 2: executors.set('capture', captureExecutor)
```

新增指令 = 注册一个 executor 函数，runner 核心循环不变。

### Decision 4: Fixture 注册表映射

```typescript
const fixtures = new Map<string, FixtureFactory>()
fixtures.set('void', (home) => { /* nothing extra */ })
fixtures.set('bare-soul', (home, opts) => createBareSoul(home, opts.soulName))
fixtures.set('distilled-soul', (home, opts) => createDistilledSoul(home, opts.soulName, opts.persona))
fixtures.set('evolved-soul', (home, opts) => createEvolvedSoul(home, opts.soulName, opts))
```

直接 import 现有 fixture 函数，不复制不修改。

### Decision 5: Reporter 接口

```typescript
interface Reporter {
  onSuiteStart(specPath: string, scenarioCount: number): void
  onScenarioStart(name: string): void
  onStepPass(step: StepDefinition, elapsed: number): void
  onStepFail(step: StepDefinition, error: Error, context: DiagnosticContext): void
  onScenarioEnd(name: string, passed: boolean, elapsed: number): void
  onSuiteEnd(passed: number, failed: number, total: number): void
}
```

Phase 0 实现 `ConsoleReporter`，失败时自动输出：
- 失败的步骤描述
- 期望 vs 实际
- Terminal screen dump（最后 15 行）
- Timeline（最后 10 条）
- Buffer tail（最后 500 字符）

### Decision 6: CLI 两种模式

**verify 模式** — 执行指定 spec 的验收场景：
```bash
bun run verify openspec/specs/soul-conversation/spec.md
bun run verify openspec/specs/                           # 全部 spec
bun run verify --change acceptance-testing-framework     # change 涉及的 spec
```

**diagnose 模式** — 快速健康检查 + 诊断：
```bash
bun run diagnose                                         # boot + 基础命令
bun run diagnose --spec soul-conversation --verbose      # 单 spec verbose
```

diagnose 和 verify 的区别：diagnose 默认 verbose（每步都输出），verify 默认 quiet（只输出失败）。

### Decision 7: 验收条件的级别

验收条件写在 **spec 级别**（长期有效），不写在 change 级别。理由：
- 验收描述的是「能力应该怎么工作」，跟着 spec 走
- change 只是触发验证的入口（通过 `--change` 参数收集涉及的 spec）
- spec 的验收条件随能力演进而更新，不会因 change 归档而丢失

## Risks / Trade-offs

**[Risk] YAML 解析错误导致验收静默跳过**
→ Mitigation: Parser 对每个 acceptance block 做 schema 校验，格式错误时报 PARSE_ERROR 而非跳过

**[Risk] TestTerminal PTY 时序不稳定导致 flaky 验收**
→ Mitigation: 复用现有 E2E 的 waitFor 机制（事件驱动，非 sleep），默认 timeout 足够宽松（10s/步）

**[Risk] 框架自身的维护成本**
→ Mitigation: Phase 0 保持极简（4 个文件 ~500 行），只在需求触发时演进

**[Trade-off] YAML 表达力 vs 编程灵活性**
→ 对于声明式覆盖不了的复杂场景（如需要编程逻辑），仍然用现有 E2E TypeScript 测试。两者共存，不互相替代。

**[Trade-off] spec 级别 vs change 级别**
→ 选择 spec 级别意味着验收条件需要在多个 change 间保持一致。如果 change 修改了行为，需要同步更新 spec 的验收 block。OpenSpec 的 archive 机制已经处理了 spec merge，所以这个风险可控。
