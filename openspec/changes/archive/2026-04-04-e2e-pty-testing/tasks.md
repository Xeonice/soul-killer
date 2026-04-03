## 1. 基础设施

- [x] 1.1 修改 `src/llm/client.ts`，baseURL 支持 `SOULKILLER_API_URL` 环境变量覆盖
- [x] 1.2 新增 `vitest.e2e.config.ts`，include `tests/e2e/**/*.test.ts`，timeout 60s
- [x] 1.3 在 `package.json` 新增 `test:e2e` script
- [x] 1.4 安装 `strip-ansi` 为 devDependency

## 2. TestTerminal

- [x] 2.1 实现 `tests/e2e/harness/test-terminal.ts` — PTY spawn、环境变量注入、进程生命周期管理 (kill, exitCode)
- [x] 2.2 实现 ANSI 剥离 + buffer 累积 + cursor 跟踪（since: 'last' 支持）
- [x] 2.3 实现 `waitFor(pattern, opts?)` 底层方法，含 WaitForTimeout 错误（附带 buffer 尾部）
- [x] 2.4 实现语义化 helpers: `waitForPrompt()`, `waitForError()`, `waitForStreamEnd()`
- [x] 2.5 实现高层 API: `send()`, `sendKey()`, `sendAndWait()`, `sendCommand()`

## 3. Fixture Helpers

- [x] 3.1 实现 `tests/e2e/fixtures/test-home.ts` — `createTestHome()`: 临时 HOME、config.yaml 预写、cleanup
- [x] 3.2 实现 `tests/e2e/fixtures/soul-fixtures.ts` — `createBareSoul()`: packageSoul + generateManifest
- [x] 3.3 实现 `createDistilledSoul()`: 默认 persona + 自定义 persona 支持
- [x] 3.4 实现 `createEvolvedSoul()`: LocalEngine.ingest + appendEvolveEntry + 内置 fixture chunks

## 4. Mock LLM Server

- [x] 4.1 实现 `tests/e2e/harness/mock-llm-server.ts` — HTTP server、POST /v1/chat/completions、SSE streaming
- [x] 4.2 实现请求录制 (server.requests 数组)
- [x] 4.3 实现 start()/stop() 生命周期方法

## 5. E2E 测试场景 — 第一层

- [x] 5.1 场景 1: 冷启动 → idle prompt (boot with animation: false)
- [x] 5.2 场景 2: /create 完整 wizard 流程 (type → name → description → tags → confirm)
- [x] 5.3 场景 3: /exit 优雅退出 (exitCode === 0)

## 6. E2E 测试场景 — 第二层

- [x] 6.1 场景 4: soul 管理 (/list 显示多个 soul, /use 切换)
- [x] 6.2 场景 5: /evolve ingest markdown → /recall 关键词检索
- [x] 6.3 场景 6: 对话流 (mock LLM 流式响应 + 上下文延续断言)

## 7. E2E 测试场景 — 第三层

- [x] 7.1 场景 7: 错误路径 (/use nonexistent, /recall 无参数, /xyzzy, 无 soul 对话)
- [x] 7.2 场景 8: Tab 补全 ("/cr" + Tab → "/create")
- [x] 7.3 场景 9: /evolve status + /evolve rollback
