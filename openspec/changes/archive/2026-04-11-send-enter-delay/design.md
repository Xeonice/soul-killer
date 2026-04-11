## Context

`send()` 逐字符发送输入，每个字符间隔 10ms，最后的 `\r` 也用同样的 10ms。当 `\r` 到达时 React 可能还没完成上一个字符的渲染，palette 状态不一致导致命令被错误处理。

## Goals / Non-Goals

**Goals:**
- 消除 `send()` 中 Enter 时序导致的 flaky 失败

**Non-Goals:**
- 不改变 `sendLine()` 或 `sendKey()` 的行为

## Decisions

将 `send()` 中 `\r` 的发送从普通字符队列中分离出来，使用 50ms 延迟替代 10ms。只改这一个数字。
