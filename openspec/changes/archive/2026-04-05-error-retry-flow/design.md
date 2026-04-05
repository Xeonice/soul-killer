## Context

`create.tsx` 的 `useInput` 对 `step === 'error'` 状态完全无处理。error UI 仅显示文本提示 "按 Esc 返回 REPL"，但 Esc 按键被忽略。

错误可能来自 4 个位置：agent capture 超时/API 错误、ingest pipeline 失败、distill LLM 调用失败、config 缺失。所有场景统一进入 `step === 'error'`。

## Goals / Non-Goals

**Goals:**
- error 状态下 Esc 能回到 REPL（调用 `onCancel()`）
- error 状态下提供"重试"选项，保留用户已输入的 name/type/description/hint，重置 agent 状态后重新触发整个 create 流程
- 重试 = 回到 `capturing`（public soul）或 `data-sources`（personal soul）

**Non-Goals:**
- 不做细粒度的断点恢复（不记住失败阶段只重试该阶段）
- 不做自动重试/指数退避

## Decisions

### D1: Error UI — 双选菜单

替换当前纯文本为可选菜单：

```
✗ 创建失败
  AI_NoOutputGeneratedError: The operation timed out

  ❯ 重试
    返回 REPL
```

用 `errorCursor` state（0=重试, 1=返回），上下键切换，Enter 确认。

### D2: 重试逻辑

重试时重置 agent 相关状态（toolCalls、classification、origin、chunks、protocolPhase、agentLog），然后根据 soulType 决定入口：
- `public` → `setStep('capturing')` + `runAgentCapture(soulName)`
- `personal` → `setStep('data-sources')`

不重置 `soulName`、`soulType`、`description`、hint 相关状态。

### D3: useInput error 分支

在 `useInput` 的处理链中增加 `step === 'error'` 分支，处理 upArrow/downArrow/return/escape。
