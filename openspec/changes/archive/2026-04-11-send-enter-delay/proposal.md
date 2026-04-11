## Why

text-input 组件的 `useInput` 回调从 React 闭包读取 `value` 和 `cursor`。当两个字符在同一个 React 渲染帧内到达时，第二个字符读到旧的闭包值，覆盖第一个字符的修改（如 `/use` 变成 `use`，丢了 `/`）。这是 E2E flaky 的根因，也影响真实用户快速打字。方向 B（延迟 `\r`）已被证伪——50ms 反而让通过率从 70% 降到 20%。

## What Changes

- 修改 `src/cli/components/text-input.tsx`：用 `useRef` 跟踪 value 和 cursor 的即时状态，`useInput` 回调从 ref 读取而非闭包，每次修改后立即同步更新 ref

## Capabilities

### New Capabilities

### Modified Capabilities

## Impact

- `src/cli/components/text-input.tsx` — 字符插入路径改用 ref 读取
- 不改变任何外部行为，只修复快速输入时的字符丢失
