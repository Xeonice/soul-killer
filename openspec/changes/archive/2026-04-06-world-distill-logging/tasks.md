## 1. AgentLogger 适配

- [x] 1.1 在 AgentLogger 中新增 `worldDistillEnd` 方法，接收 `{ entries: number; dimensions: number; totalDurationMs: number }` 参数，记录 World 蒸馏的结果摘要

## 2. WorldDistiller 接入 AgentLogger

- [x] 2.1 `distill()` 方法新增可选参数 `agentLog?: AgentLogger`，在方法入口调用 `agentLog.distillStart`
- [x] 2.2 `classifyChunks` 私有方法新增 `agentLog?` 参数，每个 batch 的 generateText 前后调用 `distillPhase`/`distillBatch`，catch 块记录错误
- [x] 2.3 `extractEntries` 私有方法新增 `agentLog?` 参数，每个维度的 generateText 前后调用 `distillBatch`，catch 块记录错误
- [x] 2.4 `reviewEntries` 私有方法新增 `agentLog?` 参数，generateText 前后调用 `distillPhase`/`distillBatch`，catch 块记录错误
- [x] 2.5 `distillFromCache()` 方法新增可选参数 `agentLog?: AgentLogger`，每个维度的 generateText 前后调用 `distillBatch`，catch 块记录错误
- [x] 2.6 `distill()` 和 `distillFromCache()` 方法末尾调用 `worldDistillEnd` 记录结果摘要
- [x] 2.7 cluster 阶段（纯计算）用 `distillPhase('cluster', 'started'/'done')` 记录耗时

## 3. 调用方接入

- [x] 3.1 `world-distill.tsx` 中 3 处 WorldDistiller 调用：创建 AgentLogger 实例（prompt 为 "World Distill: {worldName}"），传入 distill/distillFromCache，完成后调用 `agentLog.close()`
- [x] 3.2 `world-create-wizard.tsx` 中 1 处 WorldDistiller 调用：同上创建并传入 AgentLogger

## 4. 验证

- [x] 4.1 手动执行一次 world distill，确认 `~/.soulkiller/logs/agent/` 下生成日志文件，内容包含 classify/extract/review 各阶段的记录
