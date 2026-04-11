## ADDED Requirements

### Requirement: sendLine waits for echo before submitting

TestTerminal SHALL 提供 `sendLine(input: string): Promise<void>` 方法，该方法在逐字符发送后等待终端回显确认，再发送 `\r` 提交。

#### Scenario: sendLine ensures render completion before Enter
- **WHEN** 调用 `term.sendLine('/list')`
- **THEN** 方法 SHALL 逐字符发送 `/list`（每字符 10ms 间隔），等待终端 buffer 中出现输入文本的尾部片段（`since: 'last'`），确认后再发送 `\r`

#### Scenario: sendLine timeout on echo wait
- **WHEN** 调用 `term.sendLine('some-input')` 但终端未在 2000ms 内回显
- **THEN** 方法 SHALL 抛出 WaitForTimeout 错误

### Requirement: send preserved as low-level API

原 `send(input: string): void` 方法 SHALL 保持不变（fire-and-forget，逐字符 10ms 延迟 + `\r`），作为低级 API 供不需要回显等待的场景使用。

#### Scenario: send remains fire-and-forget
- **WHEN** 调用 `term.send('hello')`
- **THEN** 方法 SHALL 同步返回（void），不等待回显

### Requirement: MockLLMServer supports tool handler map

MockLLMServer SHALL 支持 `setToolHandler(toolName, handler)` 方法，按 tool name 动态路由响应。当请求包含 tool call 结果时，根据 tool name 查找 handler 生成下一轮响应。

#### Scenario: tool handler responds by name
- **WHEN** MockLLMServer 设置了 `setToolHandler('list_souls', handler)` 且收到包含 `list_souls` tool result 的请求
- **THEN** server SHALL 调用对应 handler 并返回其结果，而不是从 responseQueue 弹出

#### Scenario: fallback to responseQueue when no handler matches
- **WHEN** 请求中没有匹配的 tool handler
- **THEN** server SHALL 回退到 responseQueue（如果有），再回退到默认 responseText

### Requirement: Test files split by group

E2E 测试 SHALL 按功能组拆分为独立文件，每个文件自包含 setup/teardown。共享常量和辅助函数 SHALL 提取到 `harness/helpers.ts`。

#### Scenario: independent test file execution
- **WHEN** 运行 `bun test tests/e2e/03-soul-management.test.ts`
- **THEN** 该文件 SHALL 独立完成执行，不依赖其他测试文件的 setup

### Requirement: No hardcoded sleep in test scenarios

测试场景中 SHALL NOT 使用 `await new Promise(r => setTimeout(r, N))` 作为等待机制。所有等待 SHALL 使用 `waitFor` 或 `sendLine` 的语义等待。

#### Scenario: checkbox interaction without sleep
- **WHEN** evolve 场景中需要操作 checkbox（sendKey space/down）
- **THEN** 每次 sendKey 后 SHALL 使用 waitFor 确认状态变化，而不是 sleep(100)
