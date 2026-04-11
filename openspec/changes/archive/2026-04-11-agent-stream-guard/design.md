# agent-stream-guard — Design

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│              src/infra/agent/agent-loop.ts                   │
│                                                             │
│  runAgentLoop(options)                                      │
│  ┌───────────────────────────────────────────────────────┐  │
│  │                                                       │  │
│  │  1. AbortController setup                             │  │
│  │     └─ merge external signal + timeout(30s)           │  │
│  │                                                       │  │
│  │  2. agent.stream() — wrapped in try/catch             │  │
│  │     └─ catch → isPaymentError? → i18n error           │  │
│  │                                                       │  │
│  │  3. for await (fullStream)                            │  │
│  │     ├─ watchdog reset on non-reasoning events         │  │
│  │     ├─ error event → set streamError, break           │  │
│  │     ├─ tool-error → circuit breaker                   │  │
│  │     ├─ reasoning-delta → runaway detection            │  │
│  │     └─ onEvent(event) → caller-specific handling      │  │
│  │                                                       │  │
│  │  4. Post-stream                                       │  │
│  │     ├─ streamError? → throw immediately               │  │
│  │     └─ extractResult?(streamResult, timeout) → safe   │  │
│  │                                                       │  │
│  └───────────────────────────────────────────────────────┘  │
│                                                             │
│  Returns: AgentLoopResult { stepCount, error?, aborted }    │
│           + extractResult's return value (generic)          │
└─────────────────────────────────────────────────────────────┘
```

## Interface Design

```typescript
// ── Error detection ──

interface ApiErrorInfo {
  statusCode?: number
  message: string
  isPayment: boolean    // 402
  isAuth: boolean       // 401
  isRateLimit: boolean  // 429
}

function classifyApiError(err: unknown): ApiErrorInfo

// ── Main interface ──

interface AgentLoopOptions<TResult = void> {
  agent: ToolLoopAgent<never, any, never>
  prompt: string
  tag: string
  agentLog: AgentLogger

  // Timeouts
  watchdogMs?: number              // default 90_000
  connectTimeoutMs?: number        // default 30_000
  resultTimeoutMs?: number         // default 10_000

  // Circuit breaker
  circuitBreakerLimit?: number     // default 3

  // External abort
  abortSignal?: AbortSignal

  // Caller-specific event handling
  onEvent?: (event: StreamEvent) => void

  // Optional progress callback (for UI updates)
  onProgress?: (info: Record<string, unknown>) => void

  // Post-stream result extraction (runs inside timeout protection)
  extractResult?: (streamResult: StreamResult) => Promise<TResult>
}

interface AgentLoopResult<TResult = void> {
  stepCount: number
  llmError?: string
  aborted: boolean
  extracted?: TResult   // result from extractResult callback
}
```

## Error Classification

```typescript
function classifyApiError(err: unknown): ApiErrorInfo {
  const msg = extractApiErrorMessage(err)  // existing function
  const statusCode = extractStatusCode(err)

  return {
    statusCode,
    message: msg,
    isPayment: statusCode === 402,
    isAuth: statusCode === 401,
    isRateLimit: statusCode === 429,
  }
}

function toUserFacingError(info: ApiErrorInfo): string {
  if (info.isPayment) return t('agent.error.payment')
  if (info.isAuth)    return t('agent.error.auth')
  if (info.isRateLimit) return t('agent.error.rate_limit')
  return info.message
}
```

## Caller Integration

### capture-agent

```typescript
// Before: 80+ lines of manual stream handling
// After:
const result = await runAgentLoop({
  agent, prompt: userMessage, tag, agentLog,
  abortSignal: parentAbortSignal,
  onEvent(event) {
    if (event.type === 'tool-call' && event.toolName === 'reportFindings') {
      reportFindingsBackup = event.input
      onProgress?.({ type: 'tool_call', tool: 'reportFindings', query: '...' })
    }
    // ... other capture-specific event handling
  },
  async extractResult(streamResult) {
    const staticCalls = await streamResult.staticToolCalls
    let call = staticCalls.find(tc => tc.toolName === 'reportFindings')
    if (!call && reportFindingsBackup) { /* fallback logic */ }
    return call
  },
})
```

### distill-agent

```typescript
// Before: bare for-await with zero protection
// After:
const result = await runAgentLoop({
  agent, prompt: userMessage, tag: '[distillSoul]', agentLog,
  onEvent(event) {
    if (event.type === 'tool-call') {
      onProgress?.({ type: 'tool_call', tool: event.toolName, ... })
    }
    if (event.type === 'tool-result') {
      onProgress?.({ type: 'tool_result', tool: event.toolName, ... })
    }
  },
})
```

### export agent (existing)

Minimal change — `agent-loop.ts` moves to infra, export re-exports. The existing `runAgentLoop` call sites in export code keep working.

## i18n Keys

```json
{
  "agent.error.payment": "API 余额不足，请前往 OpenRouter 充值后重试。",
  "agent.error.auth": "API 密钥无效或已过期，请检查配置。",
  "agent.error.rate_limit": "API 请求频率超限，请稍后重试。",
  "agent.error.timeout": "Agent 超时：{seconds}秒内无响应。",
  "agent.error.connect_timeout": "无法连接到 API 服务，请检查网络。",
  "agent.error.circuit_breaker": "连续 {count} 次工具调用失败，已中止。"
}
```

## Key Decisions

1. **`extractResult` 泛型回调** — 让 `runAgentLoop<TResult>` 返回 `AgentLoopResult<TResult>`，capture-agent 可以拿到类型安全的 `reportFindings` 结果，不需要暴露 `streamResult` 到外部
2. **connectTimeoutMs 独立于 watchdog** — 初始连接和 stream 中途是不同的超时场景，分开配置
3. **`extractApiErrorMessage` 保留在 infra** — 已有函数不动，`classifyApiError` 在其基础上扩展
4. **export re-export** — `src/export/agent/agent-loop.ts` 改为 `export { runAgentLoop, ... } from '../../infra/agent/agent-loop.js'`，避免破坏 export 侧的 import 路径
