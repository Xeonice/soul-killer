## Why

ExportProtocolPanel 的 select 列表渲染全部选项，46 个角色时撑满整个终端。应该是固定高度的滚动窗口，光标移动时窗口跟随滚动，上下方有 ▲/▼ 提示还有多少项。

## What Changes

- ExportProtocolPanel 的 select ActiveZone 渲染改为固定高度窗口（默认 10 行）
- 光标移动时窗口自动滚动，保持光标在窗口内
- 窗口上下方显示 ▲/▼ 溢出提示（如 "▲ 还有 5 项" / "▼ 还有 34 项"）
- 选项数 ≤ 窗口高度时不显示提示，行为和现在一样

## Capabilities

### New Capabilities
（无）

### Modified Capabilities
- `export-protocol-panel`: select ActiveZone 渲染改为滚动窗口

## Impact

- `src/cli/animation/export-protocol-panel.tsx` — select 渲染逻辑
