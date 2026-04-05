## Context

当前 Agent Loop（`captureSoul` in `soul-capture-agent.ts`）和蒸馏流程（`extractFeatures` in `extractor.ts`）使用全局 `logger`（`src/utils/logger.ts`）向 `~/.soulkiller/debug.log` 追加日志。日志点稀疏，覆盖启动、结束、异常分支，缺乏工具调用链路、模型推理文本、搜索内部细节、蒸馏 batch 调用详情。所有调用共享同一文件，无法隔离单次 session 进行排查。

搜索工具链结构：`search-factory.ts` 创建 5 个 AI SDK `tool()`，其中 `search` 根据 provider 分发到 `searxngSearch` / `executeTavilySearch` / `executeExaSearch`，`extractPage` 调用 `extractPageContent`。底层函数均为纯函数，不带日志参数。

蒸馏流程结构：`extractor.ts` 的 `extractFeatures` 对 3 个维度（identity/style/behaviors）分别执行 batch LLM 调用（每 batch 30 chunks），然后 merge。每次调用通过 OpenAI SDK `chat.completions.create`。

模型使用 qwen3.5（通过 OpenRouter），在 tool call 前会产生推理文本，可通过 Vercel AI SDK `fullStream` 的 `text-delta` 事件捕获。

协议面板（`soulkiller-protocol-panel.tsx`）原先将所有工具调用扁平展示在一个 "正在提取神经模式..." 下，不区分 Agent 的三个阶段。

## Goals / Non-Goals

**Goals:**
- 每次 `captureSoul` 调用生成独立日志文件，文件名含时间戳和 prompt hash
- 记录完整调用链：阶段切换、模型文本输出、工具调用（输入+输出+耗时）、工具内部细节（HTTP URL/状态/原始结果数）
- 日志末尾自动生成分析摘要（维度覆盖、搜索统计、工具时间线）
- **日志贯穿 capture → distill 全流程**：蒸馏阶段记录每个 batch 的 LLM 调用耗时/输出长度、merge 操作、文件生成列表、蒸馏结果汇总
- `/config` 中提供日志清理功能，显示空间占用，二次确认
- **协议面板按 Agent 三阶段分组展示工具调用**

**Non-Goals:**
- 不替换现有全局 `logger`（`debug.log` 继续存在）
- 不做自动清理/轮转策略
- 不引入外部日志库（winston/pino 等）
- 不记录 LLM API 原始 HTTP 请求/响应体（token 安全）
- 不修改底层搜索函数签名（`searxngSearch`, `executeTavilySearch` 等保持纯函数）

## Decisions

### D1: AgentLogger 类设计

新增 `src/utils/agent-logger.ts`，导出 `AgentLogger` 类。

```
AgentLogger
├── constructor(prompt, config{model, provider, raw?})
│   → 文件名: {safeTimestamp}_{sha256(prompt).slice(0,8)}.log
│   → 创建 ~/.soulkiller/logs/agent/
│   → 写 META 头
│
├── ── Capture 阶段 ──
├── startStep(stepNumber, phase)
├── modelOutput(text)          → buffer 累积，step 切换时 flush
├── toolCall(toolName, input)
├── toolInternal(message, data?)
├── toolResult(toolName, output, durationMs)
├── writeResult(result, stepCount)
├── writeAnalysis(result, extractions?)
│
├── ── Distill 阶段 ──
├── distillStart(config{model, totalChunks, sampledChunks})
├── distillPhase(phase, 'started'|'done', detail?)
├── distillBatch(phase, batch, totalBatches, durationMs, outputLen)
├── distillMerge(phase, inputCount, durationMs, outputLen)
├── distillGenerate(files[])
├── distillEnd(result{identity, style, behaviors, totalDurationMs})
│
└── close()
```

**为什么用类不用函数集？** 需要维护文件句柄和累积状态（text buffer、step timer、tool timeline、distill phase timer），类封装最自然。

### D2: Logger 生命周期 — 跨 capture/distill

`AgentLogger` 在 `captureSoul` 中创建，但 **不在 capture 结束时关闭**。通过 `CaptureResult.agentLog` 返回给调用方 `create.tsx`，后者持有 `useRef` 传给蒸馏流程，蒸馏完成后统一 `close()`。

```
captureSoul() → 创建 logger → capture 日志 → 返回 {result, agentLog}
     ↓
create.tsx   → agentLogRef.current = result.agentLog
     ↓
startDistill() → agentLog.distillStart() → extractFeatures(..., agentLog)
     ↓           → agentLog.distillGenerate()
     ↓           → agentLog.distillEnd()
     ↓           → agentLog.close()
```

对于 UNKNOWN_ENTITY（无蒸馏）的路径，在 `create.tsx` 中立即 `close()`。

### D3: 工具内部日志钩子 — 工厂层包裹

在 `search-factory.ts` 的 `execute` 函数内包裹底层调用，手动计时和记录。**不改底层函数签名。**

**为什么不改底层函数？** 底层函数是纯函数，被测试直接调用。加 logger 参数会破坏测试、增加耦合。

### D4: 蒸馏日志 — extractor 可选参数

`extractFeatures` 新增可选的 `agentLog?: AgentLogger` 参数（末尾参数）。在每个 batch LLM 调用前后记录耗时和输出长度，merge 调用同理。不改 `mergeResults` 内部——在调用方包裹计时。

### D5: 日志文件格式 — 混合格式

人类可读文本为主体，关键数据节点附带完整 JSON 块。Capture 和 Distill 在同一文件中，用双线分隔符区分大区块。

### D6: 协议面板 — 按阶段分组

`ToolCallDisplay` 新增 `phase` 字段。`create.tsx` 在 progress callback 中用 `useRef` 跟踪当前 phase，tag 到每个 tool call。面板用 `groupByPhase()` 分组渲染，每组显示阶段标签 + 完成/spinner 状态。

已完成阶段判定：`isPhaseComplete(groupPhase, currentPhase)` 比较阶段顺序。

不同工具类型使用不同图标：🔍 search、📄 extractPage、📋 planSearch、📊 checkCoverage。

### D7: 日志清理 — /config 菜单项

在 `config.tsx` 的菜单中新增 "Clean Agent Logs" 选项。选中后：
1. `fs.readdirSync` 读取 `~/.soulkiller/logs/agent/` 文件列表
2. `fs.statSync` 累加计算总大小
3. 显示文件数和大小（MB）
4. 用户 Y/N 确认
5. 确认后 `fs.rmSync(dir, { recursive: true })` + 重建空目录

### D8: 文件命名

格式：`{YYYY-MM-DDTHH-mm-ss}_{hash8}.log`

- 时间戳用 `-` 替代 `:` 以兼容所有文件系统
- hash8 = `SHA256(原始prompt).slice(0, 8)`
- 文件头 META 区写明完整原始 prompt，不截断

## Risks / Trade-offs

**[磁盘空间增长]** → 每次全流程（capture + distill）可能产生 100KB-1MB 日志。Mitigation: `/config` 清理功能 + 日志目录与主数据目录隔离。

**[同步写入性能]** → `fs.writeSync` 在高频 text-delta 事件时可能微阻塞。Mitigation: `modelOutput` 先累积到 buffer，每个 step 结束时才 flush。蒸馏阶段 batch 粒度写入，频率低。

**[Logger 生命周期跨函数]** → `agentLog` 从 `captureSoul` 返回，由 `create.tsx` 管理关闭。如果 create 流程异常退出可能泄漏 fd。Mitigation: catch 块中也调用 `agentLog?.close()`。

**[Optional chaining 静默失败]** → 如果 agentLog 构造失败，所有日志静默丢失。Mitigation: 构造函数中 try-catch，失败时回退到全局 logger 输出 warn。
