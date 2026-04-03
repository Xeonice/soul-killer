## Context

当前 REPL 的 TextInput 组件是纯文本输入，没有任何补全能力。命令列表分散在 `command-parser.ts` 的 `KNOWN_COMMANDS` 和 `help.tsx` 的 `COMMAND_GROUPS` 中。需要统一数据源并在此基础上构建补全 UI。

## Goals / Non-Goals

**Goals:**
- 输入 `/` 后立刻显示全部命令候选列表
- 继续输入时实时前缀过滤
- 上下箭头导航、Tab/Enter 确认、Esc 关闭
- 补全后将完整命令填入输入框（含 `/` 前缀）
- 候选列表显示命令名 + 简短描述
- 视觉风格与 Cyberpunk 主题一致
- 统一命令注册表，help 和 completion 共享同一数据源

**Non-Goals:**
- 参数补全（如 `/use <name>` 中 name 的补全）—— Phase 2
- 模糊匹配（如输入 `crt` 匹配 `create`）—— 前缀匹配足够
- 命令历史补全

## Decisions

### D1: 命令注册表 — 单一数据源

**选择**: 新建 `src/cli/command-registry.ts`，导出 `COMMANDS: CommandDef[]`
**理由**: 当前命令数据分散在 command-parser.ts 和 help.tsx。统一后补全、help、解析器都从同一处读取，不会不同步。

```typescript
interface CommandDef {
  name: string        // 'create'
  description: string // '交互式创建分身'
  group: string       // '创建 & 数据'
}
```

### D2: 补全列表位置 — 输入框下方展开

**选择**: 列表渲染在 TextInput 下方
**替代**: 列表在输入框上方（像 Claude Code）
**理由**: ink 的 flexbox 布局中，向下展开最自然。REPL 输入在屏幕最下方时，列表出现在输入行之后，不会遮挡已有内容。ink 不像浏览器有 `position: fixed`，向上展开需要预留空间或 hack，复杂度不值得。

### D3: 过滤策略 — 前缀匹配

**选择**: 简单前缀匹配 `command.name.startsWith(input)`
**替代**: 模糊匹配、子序列匹配
**理由**: 命令总数 ~20 个，前缀匹配足够精确。模糊匹配在小候选集上反而可能产生意外结果。

### D4: 键盘交互模型

```
按键         列表关闭时          列表打开时
───────────────────────────────────────────
任意字符     正常输入            过滤列表
Backspace   正常删除            过滤列表（删到无 / 时关闭）
↑           无效果              上移选中项
↓           无效果              下移选中项
Tab         无效果              确认选中项，填入输入框，关闭列表
Enter       提交输入            确认选中项，填入输入框并提交
Esc         无效果              关闭列表
```

### D5: 视觉设计

```
◈ soul://void > /cr█
┌─ COMMANDS ────────────────────────┐
│ ❯ /create      交互式创建分身     │   ← 选中项 cyan 高亮
└───────────────────────────────────┘

◈ soul://void > /█
┌─ COMMANDS ────────────────────────┐
│ ❯ /create      交互式创建分身     │   ← cyan 选中
│   /feed        增量导入新数据     │   ← dim 未选中
│   /distill     手动重新蒸馏       │
│   /status      当前分身状态       │
│   /list        列出本地所有分身   │
│   ...                             │
└───────────────────────────────────┘
```

- 边框用 single style，颜色 cyan
- 标题 `COMMANDS` 用 magenta
- 选中项 cyan，未选中 dim
- 命令名左对齐，描述右对齐

## Risks / Trade-offs

### R1: ink useInput 冲突
- **风险**: TextInput 和 CommandPalette 都用 useInput，可能产生事件竞争
- **缓解**: 补全状态由 TextInput 管理，CommandPalette 不直接监听键盘，只接收 props（selectedIndex, items）。所有键盘逻辑在 TextInput 一处处理。

### R2: 长列表滚动
- **风险**: 20 个命令全展开可能太长
- **缓解**: 限制最大显示 8 项，超出部分可滚动（用 cursor 位置计算可见窗口）。
