## Context

Soulkiller 是基于 ink (React) 的 CLI REPL。现有测试覆盖：单元测试 (22 files)、组件测试 (14 files, ink-testing-library)、集成测试 (2 files)。Visual test 基础设施已搭建 (PTY + xterm.js + Playwright) 但无实际测试。缺失的是 PTY 级别的端到端测试 —— 模拟真实终端交互，验证完整用户旅程。

当前 LLM client 的 baseURL 硬编码为 `https://openrouter.ai/api/v1`，无法在测试中替换。config 和 soul 数据存储在 `~/.soulkiller/`，测试需要隔离。

## Goals / Non-Goals

**Goals:**
- 建立可靠的 PTY E2E 测试基础设施，测试不 flaky
- 覆盖 9 个核心用户旅程（冷启动、create、exit、soul 管理、evolve→recall、对话流、错误路径、Tab 补全、evolve 子命令）
- Fixture helpers 复用生产代码，不会与真实 soul 结构脱节
- Mock LLM Server 支持对话流测试
- 测试运行完全隔离，不影响用户真实数据

**Non-Goals:**
- Boot 动画的 E2E 验证（用户手动测试）
- Visual 截图回归测试（已有独立基础设施）
- 真实 LLM API 调用的 E2E（作为 CI nightly 可选项，不在本次范围）
- CI pipeline 配置（后续单独处理）

## Decisions

### D1: PTY 文本断言作为主力测试策略

**选择**: 使用 node-pty 启动真实 soulkiller 进程，通过 stdin 发送输入，断言 stdout 文本内容。

**备选方案**:
- ink-testing-library 升级为 E2E：直接 `render(<App />)`。但无法测真实终端行为（ANSI 渲染、光标、PTY 信号）。
- Playwright + xterm.js 截图：已有基础设施，但启动慢（需 HTTP server + browser），维护成本高，适合视觉回归但不适合功能验证。

**理由**: PTY 是真实度和速度的甜蜜点。真实进程、真实终端模拟，但不需要浏览器。node-pty 已在 visual harness 中引入。

### D2: TestTerminal 封装类

**选择**: 将 PTY 交互封装为 `TestTerminal` 类，提供三层 API。

**底层**: `waitFor(pattern, opts?)` — 等待 stdout 匹配正则，支持 ANSI 剥离、超时、增量匹配 (`since: 'last'`)。

**中层**: 语义化 helpers — `waitForPrompt()`, `waitForError()`, `waitForStreamEnd()`。

**高层**: 组合动作 — `sendAndWait()`, `sendCommand()`, `sendKey()`。

**关键设计点**:
- ANSI 剥离使用 `strip-ansi` 库（devDep），覆盖所有 ANSI 转义序列。
- `since: 'last'` 模式通过内部 cursor 实现，只匹配上次 waitFor 成功后新增的内容，解决历史缓冲区误匹配问题。
- `WaitForTimeout` 错误包含 buffer 尾部内容，方便调试。

### D3: 四层 Fixture Helper

**选择**: 分层设计，每层调用上层 + 补充内容，全部复用生产函数。

```
createTestHome()        → 隔离 HOME + config.yaml
createBareSoul()        → + packageSoul() + generateManifest()
createDistilledSoul()   → + generateSoulFiles() (identity/style/behaviors)
createEvolvedSoul()     → + LocalEngine.ingest() + appendEvolveEntry()
```

**备选方案**:
- 手写 fixture 文件（JSON/MD）：会与生产代码结构脱节。
- 每个测试走真实 /create 流程：慢、脆弱，create 改动会导致所有测试失败。

**理由**: 复用 `generateSoulFiles()` / `generateManifest()` / `packageSoul()` 等生产函数，fixture 结构自动与真实产物保持一致。场景 2 单独测试 /create 流程本身。

### D4: Mock LLM Server

**选择**: 简单的 Node.js HTTP server，实现 `POST /v1/chat/completions`，返回 OpenAI 兼容的 SSE stream。

**行为**:
- 固定响应文本（"I am a mock soul response"）
- 逐字符 SSE chunk 输出，模拟流式
- 记录收到的请求（用于断言上下文延续）

**注入方式**: 新增 `SOULKILLER_API_URL` 环境变量，`client.ts` 中 `baseURL: process.env.SOULKILLER_API_URL ?? 'https://openrouter.ai/api/v1'`。

**备选方案**:
- msw (Mock Service Worker)：更重，且拦截的是 Node 层网络请求，对 PTY 子进程不生效。
- 录制/回放 (VCR)：维护 fixture 文件成本高，暂不需要。

### D5: 环境隔离

**选择**: 设置 `HOME=/tmp/sk-test-<uuid>` 环境变量，使 `os.homedir()` 返回临时目录。

**理由**: config (`~/.soulkiller/config.yaml`) 和 soul 数据 (`~/.soulkiller/souls/`) 都基于 `os.homedir()`。覆盖 HOME 是最简单的隔离方式，不需要修改生产代码。`createTestHome()` 预写 `config.yaml`（animation: false, 测试 API key）。

### D6: 动画处理

**选择**: E2E 测试中 `config.yaml` 设置 `animation: false`，跳过 boot/exit 动画。确定性通过 `SOULKILLER_SEED=42` 环境变量保证（已有支持）。

## Risks / Trade-offs

- **[node-pty 构建依赖]** → node-pty 需要 C++ 编译器。开发机通常有，CI 需要额外配置。后续 CI 任务单独处理。
- **[ink 渲染时序]** → React batch updates 可能导致 waitFor 匹配到中间帧。通过 `waitForPrompt()`（等待命令完全完成）缓解。
- **[Prompt 正则脆弱性]** → prompt 渲染格式变化会导致 `waitForPrompt` 失效。集中定义 prompt 匹配正则，变更时只改一处。
- **[测试速度]** → PTY 启动 + boot 跳过 约 1-2 秒/测试。9 个场景总计 ~20-30 秒，可接受。
- **[strip-ansi 版本]** → strip-ansi v7+ 是 ESM only，需确认与项目 ESM 配置兼容。项目已是 ESM (`"type": "module"`)，无障碍。
