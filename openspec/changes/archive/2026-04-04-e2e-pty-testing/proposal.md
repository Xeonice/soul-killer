## Why

Soulkiller 目前只有单元测试和组件测试，无法验证完整的用户旅程（boot → create → use → evolve → recall → 对话 → exit）。REPL 的核心价值链从未被端到端验证过，回归风险高。需要基于 PTY 的 E2E 测试框架，模拟真实终端交互，覆盖所有关键用户路径。

## What Changes

- 新增 `TestTerminal` 类：封装 node-pty 进程管理、ANSI 剥离、`waitFor` 模式匹配、按键发送
- 新增四层 fixture helper：`createTestHome()` → `createBareSoul()` → `createDistilledSoul()` → `createEvolvedSoul()`，全部复用生产代码
- 新增 Mock LLM Server：本地 HTTP server 返回 SSE 格式的固定响应，用于对话流测试
- 新增 `SOULKILLER_API_URL` 环境变量支持：允许覆盖 LLM client 的 baseURL
- 新增 9 个 E2E 测试场景覆盖：冷启动、/create 链路、优雅退出、soul 管理、evolve→recall、对话流、错误路径、Tab 补全、evolve 子命令
- 新增 vitest E2E 配置文件

## Capabilities

### New Capabilities
- `e2e-test-harness`: PTY 测试基础设施 — TestTerminal 类、waitFor 工具函数、ANSI 剥离、按键模拟
- `e2e-fixture-helpers`: 四层 soul fixture 预制系统 — createTestHome/createBareSoul/createDistilledSoul/createEvolvedSoul
- `e2e-mock-llm`: Mock LLM Server — 本地 OpenAI 兼容 API，SSE 流式响应，请求录制
- `e2e-scenarios`: 9 个端到端测试场景覆盖完整用户旅程

### Modified Capabilities
- `openrouter-integration`: LLM client baseURL 需支持环境变量覆盖 (`SOULKILLER_API_URL`)

## Impact

- **新增依赖**: `strip-ansi` (devDep，ANSI 剥离)
- **修改文件**: `src/llm/client.ts` (baseURL 环境变量支持，一行改动)
- **新增文件**: `tests/e2e/` 目录下的 harness、fixtures、mock server、测试文件
- **新增配置**: `vitest.e2e.config.ts`
- **CI 影响**: node-pty 需要 C++ 构建工具链 (GitHub Actions Linux 上需配置)
