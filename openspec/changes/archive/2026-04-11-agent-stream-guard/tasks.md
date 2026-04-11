# agent-stream-guard — Tasks

## Tasks

- [x] 1. 移动 `agent-loop.ts` 到 `src/infra/agent/`，export 侧改为 re-export
- [x] 2. 增加 `classifyApiError` + `toUserFacingError`，识别 402/401/429
- [x] 3. 增强 `runAgentLoop`：初始连接超时、stream error 立即 throw、`extractResult` 泛型回调
- [x] 4. 添加 i18n keys（zh/en/ja）
- [x] 5. capture-agent 接入 `runAgentLoop`（移除自有 stream 循环）
- [x] 6. distill-agent 接入 `runAgentLoop`（移除裸跑 for-await）
- [x] 7. 测试：单元测试覆盖 error classification + timeout 行为
