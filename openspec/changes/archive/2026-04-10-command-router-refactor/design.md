## Context

`src/cli/app.tsx` 的 `handleInput` 函数是一个 387 行的 switch-case，承担了命令解析后的全部分发逻辑。当前项目有 17 个命令分支，其中 evolve 有 3 个子命令。每个分支重复编写参数验证、前置条件检查、错误报告和 interactiveMode 管理。

现有的 `command-registry.ts` 只存储命令元数据（name / descriptionKey / groupKey），仅用于补全和帮助显示，不参与路由。

## Goals / Non-Goals

**Goals:**
- 将 app.tsx 的 handleInput 从 387 行 switch-case 缩减至单行 `router.dispatch()` 调用
- 每个命令自描述前置条件和行为特征，新增命令不需要修改 app.tsx
- 消除重复的参数验证、前置条件检查和 interactiveMode 管理 boilerplate
- 支持 evolve 式的二级子命令路由

**Non-Goals:**
- 不改变任何命令组件的内部实现
- 不重新组织 commands/ 目录结构（留给后续变更）
- 不改变对话流（natural input）的处理逻辑
- 不引入命令的动态注册或插件机制

## Decisions

### 1. CommandHandler 接口设计

```typescript
interface SubcommandHandler {
  requires?: Array<'soul' | 'engine' | 'args' | 'conversation'>
  argDef?: { name: string }
  interactive?: boolean
  handle(ctx: CommandContext): React.ReactNode | void
}

interface CommandHandler extends SubcommandHandler {
  name: string
  descriptionKey: string
  groupKey: string
  subcommands?: Record<string, SubcommandHandler>
}
```

**为什么 requires 用字符串数组而非布尔字段？** 因为前置条件是可组合的（recall 需要 args + engine），且路由器需要统一遍历检查。字符串标签比 `requiresSoul: boolean, requiresEngine: boolean` 更易扩展。

**为什么 handle 返回 `ReactNode | void`？** 大部分命令返回 ReactNode 给 commandOutput，但 `/exit` 只改 phase 不渲染组件，所以需要 void 路径。

### 2. CommandContext 设计

```typescript
interface CommandContext {
  args: string
  state: Readonly<AppState>
  setState: SetStateFn
  engineRef: React.RefObject<EngineAdapter | null>
  conversationRef: React.RefObject<ChatMessage[]>
  closeInteractive: () => void
  handleRecallResults: (results: RecallResult[]) => void
  handleCreateComplete: (name: string, dir: string) => void
  handleUseComplete: (dir: string) => void
}
```

Context 传递 app 级状态和回调的只读引用。命令通过 `ctx.setState` 处理特殊副作用（如 evolve 加载 soul 时改 soulDir）。`closeInteractive` 是提取出的通用回调工厂，消除 10 处重复的 `() => setState(s => ({ ...s, interactiveMode: false, commandOutput: null }))` 。

### 3. 子命令分发策略

路由器对带 `subcommands` 字段的命令做二级分发：取 `args` 的首个 token 匹配子命令表，匹配成功则消费该 token 并将剩余 args 传给 sub handler。不匹配则走默认 handle。

```
/evolve status     → subcommands['status'].handle(ctx)
/evolve rollback   → subcommands['rollback'].handle(ctx)
/evolve saber      → handle(ctx)  (args = 'saber')
```

**为什么不用通用嵌套路由？** 项目中只有 evolve 需要路由层子命令。model/pack 的子参数由组件内部自行处理，不需要路由器介入。过度设计嵌套路由只会增加复杂度。

判断准则：子命令是否需要操作 AppState 或需要不同的 requires 前置条件？是 → 路由器 subcommands；否 → 组件内处理。

### 4. 路由器 dispatch 流程

```
dispatch(parsed, ctx):
  1. registry.get(parsed.name) → handler | null
  2. if null → suggestCommand → 报 UNKNOWN COMMAND → return
  3. if handler.subcommands:
     a. firstToken = args.split(/\s+/)[0]
     b. if subcommands[firstToken] exists:
        - effective = subcommands[firstToken]
        - ctx.args = args 去掉 firstToken 部分
     c. else: effective = handler
  4. for each req in effective.requires:
     - 'args': if !ctx.args → 报 MISSING ARGUMENT (用 argDef.name)
     - 'soul': if !state.soulDir → 报 NO SOUL
     - 'engine': if !engineRef.current → 报 NO ENGINE
     - 'conversation': if conversationRef.current.length < 2 → 报 NO CONVERSATION
     → return on first failure
  5. result = effective.handle(ctx)
  6. if result is ReactNode:
     setState({ commandOutput: result, interactiveMode: effective.interactive ?? false })
```

### 5. 注册表扩展策略

不替换现有的 `command-registry.ts`，而是在其基础上扩展。`COMMAND_TEMPLATES` 继续保留用于 i18n 驱动的补全列表。新增一个并行的 handler 注册表（`Map<string, CommandHandler>`），由 `commands/index.ts` 聚合所有命令的 handler 定义后注册。

`getCommands()` 和 `COMMANDS` proxy 保持不变，避免影响 help、补全等已有消费方。

### 6. status 命令的异步处理

status 是唯一一个在路由层做 async engine 调用的命令。方案：让 `handle` 支持返回 `Promise<ReactNode | void>`，路由器的 dispatch 本身已在 async handleInput 内调用，天然支持 await。

## Risks / Trade-offs

- **[Risk] evolve default handler 的 AppState 副作用** → handler 内通过 ctx.setState 直接操作，路由器的通用 setState（步骤 6）只在 handler 返回 ReactNode 时触发，handler 返回 void 时跳过。evolve default handler 先 setState 加载 soul，再返回 CreateCommand 组件。
- **[Risk] 回调引用稳定性** → CommandContext 中的回调（handleCreateComplete 等）来自 app.tsx 的 useCallback，引用稳定。ctx 对象在每次 dispatch 时构造，不持久化。
- **[Trade-off] 不做命令文件的目录重组** → 减少变更范围和 import 路径变化，但 23 个平铺文件的问题留存。这是有意为之——一次只解决一个问题。
- **[Trade-off] handler 注册表与 COMMAND_TEMPLATES 并存** → 存在两个"命令列表"，但职责不同（元数据 vs 行为），且 COMMAND_TEMPLATES 是 handler 注册表的子集信息，不会产生不一致。
