## Why

`/create` 或 `/use` 完成后回到 REPL，整个 UI 显示为空。原因是 `handleCreateComplete` 和 `handleUseComplete` 设置了 `interactiveMode: false` 但**没有清空 `commandOutput`**，导致已完成的 CreateCommand/UseCommand 组件继续渲染（处于 done 状态，显示为空白）。

## What Changes

- `handleCreateComplete` 和 `handleUseComplete` 中补充 `commandOutput: null`

## Capabilities

### New Capabilities
（无）

### Modified Capabilities
（无，仅 bug fix）

## Impact

- `src/cli/app.tsx` — 两处 setState 调用补充 `commandOutput: null`
