## Context

app.tsx 中所有 interactive command 的 completion handler 都应该清空 `commandOutput`。大部分 handler 已经正确处理，但 `handleCreateComplete` 和 `handleUseComplete` 遗漏了。

## Goals / Non-Goals

**Goals:**
- 修复两处遗漏

**Non-Goals:**
- 不做架构改动
