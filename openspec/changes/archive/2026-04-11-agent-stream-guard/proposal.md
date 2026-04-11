# agent-stream-guard

## Problem

Agent 调用（capture / distill / export）在 API 返回 402/401/429（余额不足、key 无效、限流）时不会报错，而是直接卡死。三个 agent 各自独立实现 stream 消费逻辑，防护能力参差不齐：

| | capture-agent | distill-agent | agent-loop (export) |
|---|---|---|---|
| watchdog | ✅ 90s | ❌ 无 | ✅ 可配 |
| circuit breaker | ❌ | ❌ | ✅ 3次 |
| AbortController | ✅ | ❌ | ✅ |
| error event 处理 | ⚠️ break 但后续 hang | ❌ | ✅ |
| 402 专项检测 | ❌ | ❌ | ❌ |

### 具体卡死点

1. **capture-agent:655** — stream error 后 `await streamResult.staticToolCalls` 永远不 resolve，且 watchdog 已清除
2. **distill-agent:606** — 完全无 AbortController、无 watchdog、无 error 处理，裸跑 `for await`
3. **agent.stream() 初始连接** — 所有调用方都没有对初始 HTTP 连接加超时保护

## Solution

将 `src/export/agent/agent-loop.ts` 提升为 `src/infra/agent/agent-loop.ts`，作为所有 agent stream 消费的统一入口。三个 agent 全部接入。

### 核心改动

1. **移动 `agent-loop.ts`** → `src/infra/agent/agent-loop.ts`，export 侧改为 re-export
2. **增强 `runAgentLoop`**：
   - 初始连接超时：`agent.stream()` 调用增加 `AbortSignal.timeout(30s)` 保护
   - 402/401/429 检测：`isPaymentError()` 识别支付相关错误，立即 abort + 用户友好提示
   - `extractResult` 回调：在 loop 内部做带超时的 `staticToolCalls` await（10s），替代调用方自行 await
   - stream error → 立即 throw，不再继续执行后续 await
3. **`onEvent` 回调**：各调用方通过回调自定义事件处理（capture 跟踪 reportFindings、distill 跟踪 progress），通用逻辑由 loop 管理
4. **capture-agent 接入**：移除自有 watchdog/stream 循环，改用 `runAgentLoop` + `onEvent` + `extractResult`
5. **distill-agent 接入**：移除裸跑 `for await`，改用 `runAgentLoop` + `onEvent`
6. **i18n**：新增 `agent.error.payment`、`agent.error.auth`、`agent.error.rate_limit`、`agent.error.timeout` 等 key

### 不改动

- agent 的 tool 定义、prepareStep、stopWhen 逻辑不变
- 各 agent 的业务逻辑（维度评估、蒸馏流程、export 步骤）不变
- export agent-loop 原有的 reasoning runaway 检测保留

## Scope

- `src/infra/agent/agent-loop.ts` (新，从 export 移入+增强)
- `src/export/agent/agent-loop.ts` (改为 re-export)
- `src/infra/agent/capture-agent.ts` (stream 消费改用 runAgentLoop)
- `src/soul/distill/distill-agent.ts` (stream 消费改用 runAgentLoop)
- `src/infra/i18n/locales/{zh,en,ja}.json` (新增 agent error keys)
- 相关测试文件

## Risks

- `onEvent` 回调的类型签名需要兼容三个 agent 的不同事件处理需求
- `staticToolCalls` 超时兜底可能在某些慢模型上误触（10s 应足够，可配置）
- distill-agent 首次接入 AbortController，需确认 ToolLoopAgent 在 abort 后的清理行为
