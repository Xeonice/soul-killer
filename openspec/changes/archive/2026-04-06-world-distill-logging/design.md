## Context

Soul 流程的 capture 和 distill 阶段都已接入 AgentLogger，每次 LLM 调用的 prompt、response、耗时、错误都写入 `~/.soulkiller/logs/agent/` 下的独立日志文件。WorldDistiller 是唯一未接入的 LLM 密集模块，包含 5 处 `generateText` 调用点，且所有异常被 `catch {}` 静默吞掉。

现有日志基础设施（AgentLogger）已提供了 `distillStart`/`distillPhase`/`distillBatch`/`distillMerge`/`distillEnd` 等方法，完全适用于 WorldDistiller 的场景，无需新增 AgentLogger API。

## Goals / Non-Goals

**Goals:**
- WorldDistiller 的所有 generateText 调用接入 AgentLogger，与 Soul Distill（extractor.ts）同等级别
- 静默 catch 块记录错误信息到日志，保持不抛出的行为
- 调用方创建 AgentLogger 实例并传入

**Non-Goals:**
- 不改变 WorldDistiller 的 EventEmitter 进度事件机制（UI 进度条不受影响）
- 不为 AgentLogger 添加新的公开方法
- 不改变 WorldDistiller 的公开 API 签名（agentLog 为可选参数）
- 不涉及 World Capture Agent 的日志（已有）

## Decisions

### 决策 1: AgentLogger 作为方法参数而非构造函数参数

**选择**: `distill(... , agentLog?)` 和 `distillFromCache(... , agentLog?)` 方法级参数

**替代方案**: 构造函数 `new WorldDistiller(model, agentLog?)`

**理由**: 同一个 WorldDistiller 实例可能被多次调用（如 evolve），每次调用应有独立的日志会话。方法级参数与 `extractor.ts` 的 `extractFeatures(..., agentLog?)` 模式一致。

### 决策 2: 复用现有 AgentLogger 方法，不新增 API

**选择**: 用 `distillPhase`/`distillBatch`/`distillEnd` 记录 World 蒸馏

**理由**: 现有方法的语义完全覆盖 World 蒸馏的需求：
- `distillStart` → 记录模型、chunk 数
- `distillPhase('classify'/'extract'/'review')` → 标记阶段
- `distillBatch` → 每次 generateText 调用
- `distillEnd` → 最终统计

唯一适配点：`distillEnd` 目前接收 `{ identity, style, behaviors, totalDurationMs }`，需要扩展为也能接收 World 的 `{ entries, dimensions, totalDurationMs }` 格式，或在 WorldDistiller 侧用 `distillPhase` + `writeLine` 替代。

**选择**: 在 AgentLogger 中新增 `worldDistillEnd` 方法或将 `distillEnd` 参数泛化为 `Record<string, number>`，避免 Soul 和 World 的结果格式耦合。

### 决策 3: 私有方法传递 agentLog 而非实例变量

**选择**: `classifyChunks(..., agentLog?)`, `extractEntries(..., agentLog?)`, `reviewEntries(..., agentLog?)`

**理由**: 保持与现有代码结构一致——这些是无状态的私有方法，通过参数传递比临时设置实例变量更清晰，避免并发调用时的状态污染。

### 决策 4: catch 块记录错误但不改变控制流

**选择**: `catch (err) { agentLog?.toolInternal('ERROR: ...', err); /* 保持原有 fallback 逻辑 */ }`

**理由**: WorldDistiller 的错误恢复策略（JSON 解析失败时 fallback 到原始内容）是正确的设计。日志只增加可观测性，不改变行为。

## Risks / Trade-offs

- **日志文件体积增长**: World 蒸馏的 generateText 调用输入/输出都较大（classifyChunks 的 batch 内容、extractEntries 的 combined content）。记录完整 JSON 会使单个日志文件增大。→ **缓解**: 沿用现有 AgentLogger 的模式，记录完整 JSON 是期望行为（与 Soul 一致），用户可通过日志清理功能管理。
- **distillEnd 参数泛化**: 修改 distillEnd 签名可能影响现有 Soul 调用方。→ **缓解**: 使用联合类型或新增 worldDistillEnd 方法。
