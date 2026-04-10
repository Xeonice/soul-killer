## Context

ExportProtocolPanel 第 227 行 `activeZone.options.map` 直接渲染全部选项。

## Goals / Non-Goals

**Goals:**
- 固定高度滚动窗口（默认 10 行）
- 光标移动时窗口跟随
- ▲/▼ 溢出提示

**Non-Goals:**
- 不改键盘交互逻辑（上下箭头、空格、Enter 不变）
- 不改 select state 结构

## Decisions

### 窗口计算逻辑

```
WINDOW_SIZE = 10
total = options.length

if (total <= WINDOW_SIZE):
  // 不需要窗口化，渲染全部
  windowStart = 0
  windowEnd = total
else:
  // 保持 cursor 在窗口中间偏上（距顶部 3 行）
  windowStart = max(0, min(cursor - 3, total - WINDOW_SIZE))
  windowEnd = windowStart + WINDOW_SIZE

visibleOptions = options.slice(windowStart, windowEnd)
hasAbove = windowStart > 0
hasBelow = windowEnd < total
```

### 溢出提示

```
hasAbove → "  ▲ 还有 {windowStart} 项"（DIM 颜色）
hasBelow → "  ▼ 还有 {total - windowEnd} 项"（DIM 颜色）
```

提示在边框内，占据列表的第一行/最后一行位置。
