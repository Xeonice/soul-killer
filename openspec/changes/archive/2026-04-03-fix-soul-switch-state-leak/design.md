## Context

`app.tsx` 中有三种方式设置新 soul：`handleUseComplete`、`handleCreateComplete`、evolve 路由中的直接 setState。它们都只更新 `soulName`/`soulDir`/`promptMode`，没有清空 `conversationMessages`（state）和 `conversationRef.current`（ref）。

## Goals / Non-Goals

**Goals:**
- 所有 soul 切换路径都清空对话状态
- conversationRef 和 conversationMessages 保持同步

**Non-Goals:**
- 不做对话历史持久化（保存旧对话到文件）— 未来可作为独立功能

## Decisions

在每个设置新 soulDir 的地方，同时执行：
```
conversationMessages: []
conversationRef.current = []
```

不抽象为 helper 函数——只有 3 个调用点，直接内联更清晰。
