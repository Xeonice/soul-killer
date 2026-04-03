## Context

已有 CommandPalette 做斜杠命令补全，PathPalette 做路径补全。现在需要第三种补全场景：命令参数补全。`/use` 后面跟的是 soul 名，数据源是 `~/.soulkiller/souls/` 下的目录列表。同时 soul 加载需要一个 Cyberpunk 风格的 Relic 激活动画。

## Goals / Non-Goals

**Goals:**
- `/use ` 后自动补全本地 soul 列表
- 复用 CommandPalette 的 UI 组件（改标题为 "SOULS"）
- Soul 加载后播放 Relic 激活动画（~2.5s）
- 动画展示 soul 基本信息（名称、记忆数、语言）

**Non-Goals:**
- 远程 soul 搜索/补全（Phase 2）
- `/switch` 命令的补全（后续复用同一机制）
- `/model` 的模型 ID 补全（后续复用）

## Decisions

### D1: 命令参数补全 — 扩展 TextInput 的 completionItems

新增一个 `argCompletionMap` prop：

```typescript
type ArgCompletionMap = Record<string, () => CommandDef[]>
// key: 命令名, value: 获取参数候选列表的函数

// 例：
{ use: () => listLocalSouls().map(s => ({ name: s.name, description: s.description, group: 'souls' })) }
```

TextInput 逻辑：
1. 输入 `/use ` 后（命令名 + 空格），检查 `argCompletionMap['use']`
2. 如果存在，调用函数获取候选列表
3. 用空格后的文字做前缀过滤
4. 渲染 CommandPalette（标题改为从数据推断，或新增 `title` prop）

### D2: soul-resolver — 列出本地 souls

```typescript
// src/cli/soul-resolver.ts
function listLocalSouls(): { name: string; description: string; chunkCount: number }[]
```

读取 `~/.soulkiller/souls/` 下每个子目录的 `manifest.json`（如果存在）。

### D3: CommandPalette 标题可配置

CommandPalette 新增可选 `title` prop，默认 "COMMANDS"。参数补全时传 "SOULS"。

### D4: RelicLoadAnimation — 4 阶段动画

```
Phase 1: Neural Link (~0.5s)
  ▓ establishing neural link...
  glitch 闪烁效果

Phase 2: Relic Sync (~1s)
  心电图从 flatline → 活跃（HeartbeatLine health 0→1）
  RELIC STATUS 进度条 0% → 100%
  颜色 dim → magenta → cyan

Phase 3: Soul Info (~0.5s)
  显示：soul 名、记忆数、语言
  从 manifest.json 读取

Phase 4: Tagline + 过渡 (~0.5s)
  「 neural link established. soul loaded. 」
  过渡到 REPL prompt
```

总时长 ~2.5s，使用 seeded GlitchEngine 保证测试可复现。

### D5: /use 流程改造

```
之前: /use name → 检查本地 → 加载 → 切换 prompt
之后: /use name → 检查本地 → 播放 RelicLoadAnimation → 加载 → 切换 prompt
```

use.tsx 变成交互式命令（interactiveMode: true），动画播放完后 onComplete。

## Risks / Trade-offs

### R1: argCompletionMap 函数调用时机
- **风险**: listLocalSouls 每次按键都调用 fs.readdirSync
- **缓解**: soul 数量通常 < 20，readdirSync 在这个规模下毫秒级。如果后续需要可加缓存。
