## Context

World distill 的 history 维度走 `runHistoryThreePass`，其中 Pass B 对 Pass A 返回的每个事件逐个调 LLM（5 并发），每个 ~50s。Fate Zero 等内容密集的世界可能有 20+ 事件，Pass B 总耗时 10-20 分钟。期间 UI 和 agent log 几乎无输出。

现有进度机制：
- `this.emit('progress', ...)` → ink panel 渲染
- `agentLog?.distillBatch(...)` → agent log 文件写入
- Pass B 只在每批（5 个）完成后 emit 一次，agent log 只在 Pass B 整体完成后写 1 行

## Goals / Non-Goals

**Goals:**
- Pass B 每完成一个事件，立即 emit progress + 写 agent log
- UI panel 在 history 维度时展示 Pass A/B/C 子阶段和 per-event 进度
- 用户在 Pass B 期间能清楚看到"正在展开第 12/20 个事件：fourth-grail-war"

**Non-Goals:**
- 不改 Pass A / Pass C 的进度粒度（单次 LLM 调用，spinner 就够了）
- 不改非 history 维度的进度机制
- 不改 distill 逻辑或结果

## Decisions

### 1. WorldDistillProgress 类型扩展

```ts
interface WorldDistillProgress {
  // ...existing fields
  historySubProgress?: {
    pass: 'A' | 'B' | 'C'
    eventsDone: number
    eventsTotal: number
    currentEvent?: string      // 正在处理的事件名（Pass B）
    completedEvents?: string[] // 已完成的事件名列表（Pass B）
  }
}
```

### 2. distill.ts 改动

Pass B 内部 `batch.map` 的每个 event resolve 后：

```ts
// 每个事件完成时
agentLog?.distillBatch(
  `history:pass-b:${item.name}`,
  passBDone + 1, passBTasks.length,
  Date.now() - eventStart, body.length
)
this.emit('progress', {
  phase: 'extract',
  current: completed,
  total: dimFiles.length,
  message: `history: Pass B — ${item.name}`,
  entryDimension: 'history',
  historySubProgress: {
    pass: 'B',
    eventsDone: passBDone,
    eventsTotal: passBTasks.length,
    currentEvent: item.name,
    completedEvents: [...doneNames],
  },
})
```

Pass A 开始/完成时也带 `historySubProgress: { pass: 'A', ... }`，Pass C 同理。

### 3. world-distill-panel.tsx 改动

检测 `progress.historySubProgress` 存在时，在 history 维度行下方渲染子进度：

```
▸ history — Pass B: 12/20 events ⠋
  ▸ founding-of-fuyuki ✓
  ▸ first-grail-war ✓
  ▸ fourth-grail-war ⠋
```

只显示最近 3 个已完成事件 + 当前正在处理的事件（避免列表过长）。

## Risks / Trade-offs

| 风险 | 缓解 |
|------|------|
| 高频 emit 可能导致 ink 重绘闪烁 | 每个事件 ~50s 才 emit 一次，频率极低 |
| agent log 行数增多 | 每个事件一行，20 个事件加 20 行，完全可接受 |
