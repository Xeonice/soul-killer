## Why

`app.tsx` 的 `handleInput` 是一个 795 行的上帝组件，其中 387 行是一个巨型 switch-case，包含 17 个命令分支。每个分支混合了参数验证、前置条件检查、错误报告和组件挂载，导致：

- 新增命令必须修改 app.tsx，且每次都要重复相同的 boilerplate（参数缺失报错 ×4、soul 未加载报错 ×3、interactive 退出回调 ×10）
- evolve 子命令（status/rollback/default）的 116 行逻辑全部泄漏在路由层，夹杂业务逻辑
- 命令的行为特征（需要 soul？需要参数？是否 interactive？）分散在 switch 各处，无法被统一检查或复用

## What Changes

- 新增 `CommandHandler` 接口，让每个命令自描述其前置条件（requires）、参数定义（argDef）、交互模式（interactive）和处理函数（handle）
- 新增 `command-router.ts`，实现通用的前置条件检查和命令分发，包括可选的二级子命令路由
- 扩展 `command-registry.ts`，从纯元数据注册表升级为包含 handler 的完整命令注册表
- 重写 `app.tsx` 的 `handleInput`，从 387 行 switch-case 替换为 `router.dispatch(parsed, ctx)` 单行调用
- 每个 `commands/*.tsx` 文件新增 `CommandHandler` 导出，将原本散落在 app.tsx 中的参数验证和前置条件逻辑内聚到命令自身
- evolve 的三条路径拆分为独立的 SubcommandHandler（status / rollback / default），各自声明 requires

## Capabilities

### New Capabilities
- `command-router`: 通用命令路由器，负责前置条件检查、参数验证、子命令分发和 interactiveMode 管理

### Modified Capabilities
- `repl-shell`: handleInput 从 switch-case 改为 router.dispatch，app.tsx 瘦身至 ~250 行

## Impact

- **核心变更文件**: `src/cli/app.tsx`（重写 handleInput）、`src/cli/command-registry.ts`（扩展接口）
- **新增文件**: `src/cli/command-router.ts`、`src/cli/commands/index.ts`
- **每个命令文件**: `src/cli/commands/*.tsx` 各增加 ~5-15 行 handler 定义导出
- **不影响**: 所有命令组件的内部实现、animation、components、对话流逻辑、E2E 测试行为
- **风险点**: evolve 的 AppState 副作用（加载 soul 时改 soulName/soulDir/promptMode）需要在 handler 内通过 ctx.setState 处理；status 命令的异步 engine 调用需要 handler 支持异步
