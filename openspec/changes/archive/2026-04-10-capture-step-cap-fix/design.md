## Context

当前公式：`maxSteps = Math.min(dimCount * 2 + 5, 80)`
7 维度 → 19 步，不够用。

## Goals / Non-Goals

**Goals:**
- 保证普通角色至少 30 步
- 不支持 toolChoice:required 的模型也能被引导调用 reportFindings

**Non-Goals:**
- 不改 strategy 的 system prompt（已在上一个 change 处理）

## Decisions

### maxSteps 公式

```
maxSteps = Math.max(30, Math.min(dimCount * 3 + 8, 80))
```

- 基线 30 步（即使 dimCount 很小也不会低于 30）
- 每维度 3 步（evaluate + 1-2 supplement）
- +8 余量（reportFindings + 重试）
- 硬上限仍为 80

### prepareStep fallback：prompt 引导

当模型不支持 `toolChoice: 'required'` 时，`prepareStep` 不能强制 toolChoice，但可以返回额外的 system prompt。在接近 step cap 时（stepNumber >= maxSteps - 3），通过 `messages` 追加一条 system 消息引导模型立即调用 reportFindings。

AI SDK 的 `prepareStep` 返回值支持 `messages` 字段（追加消息到对话），可以用这个机制：

```typescript
return {
  messages: [{
    role: 'system',
    content: 'You are running out of steps. IMMEDIATELY call reportFindings now with your current findings.'
  }]
}
```
