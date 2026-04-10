## ADDED Requirements

### Requirement: 固定高度滚动窗口
ScrollableList SHALL 渲染最多 `maxVisible`（默认 10）个 item，当 item 总数超过 maxVisible 时启用滚动窗口。

#### Scenario: 少于 maxVisible 个 item
- **WHEN** items 有 5 个且 maxVisible=10
- **THEN** 渲染全部 5 个 item，无 ▲▼ 指示器

#### Scenario: 超过 maxVisible 个 item
- **WHEN** items 有 20 个且 maxVisible=10
- **THEN** 只渲染 10 个 item，并根据 cursor 位置显示 ▲ 和/或 ▼ 指示器

### Requirement: Cursor 跟随滚动
滚动窗口 SHALL 跟随 cursor 移动，使 cursor 始终在可见范围内，偏上方约 1/3 处。

#### Scenario: cursor 在列表中间
- **WHEN** cursor=12，total=20，maxVisible=10
- **THEN** 窗口 SHALL 显示 index 9-18，cursor 在窗口第 4 行

#### Scenario: cursor 在列表顶部
- **WHEN** cursor=0，total=20，maxVisible=10
- **THEN** 窗口 SHALL 显示 index 0-9

#### Scenario: cursor 在列表底部
- **WHEN** cursor=19，total=20，maxVisible=10
- **THEN** 窗口 SHALL 显示 index 10-19

### Requirement: 溢出指示器
当有超出可见范围的 item 时，ScrollableList SHALL 显示方向指示器和溢出数量。

#### Scenario: 上方有隐藏 item
- **WHEN** windowStart > 0
- **THEN** 在可见列表上方显示 `▲ N more`（N 为隐藏数量）

#### Scenario: 下方有隐藏 item
- **WHEN** windowEnd < total
- **THEN** 在可见列表下方显示 `▼ N more`（N 为隐藏数量）

### Requirement: 空列表处理
当 items 为空时，ScrollableList SHALL 渲染 emptyMessage（如提供）或不渲染。

#### Scenario: 空列表有 emptyMessage
- **WHEN** items 为空且 emptyMessage="No souls found"
- **THEN** 渲染 emptyMessage 文本

### Requirement: /list soul-list 使用 ScrollableList
`/list` 命令的 soul-list 阶段 SHALL 使用 ScrollableList 替换裸 `.map()` 渲染。

#### Scenario: soul 列表滚动
- **WHEN** 用户有 15 个 soul 并执行 /list
- **THEN** 显示固定高度窗口，可通过 ↑↓ 滚动浏览

### Requirement: /world world-list 使用 ScrollableList
`/world` 命令的 world-list 阶段 SHALL 使用 ScrollableList 替换裸 `.map()` 渲染。

#### Scenario: world 列表滚动
- **WHEN** 用户有 12 个 world 并执行 /world → 管理
- **THEN** 显示固定高度窗口，可通过 ↑↓ 滚动浏览
