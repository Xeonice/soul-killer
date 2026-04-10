## 1. 类型与接口定义

- [x] 1.1 在 `src/cli/command-registry.ts` 中新增 `SubcommandHandler`、`CommandHandler`、`CommandContext` 接口定义
- [x] 1.2 在 `src/cli/command-registry.ts` 中新增 handler 注册表（`Map<string, CommandHandler>`）及 `registerCommand` / `getHandler` 函数

## 2. 路由器实现

- [x] 2.1 创建 `src/cli/command-router.ts`，实现 `dispatch(parsed, ctx)` 函数：前置条件检查、子命令分发、handle 返回值处理
- [x] 2.2 dispatch 中实现 unknown command 处理（suggestCommand 模糊匹配）

## 3. 命令 Handler 迁移

- [x] 3.1 简单命令：为 help、model、source 创建 CommandHandler 导出
- [x] 3.2 带参数命令：为 use、recall、pack、unpack 创建 CommandHandler 导出（requires: ['args']，含 argDef）
- [x] 3.3 Interactive 命令：为 config、create、list、world、export、feedback 创建 CommandHandler 导出（interactive: true）
- [x] 3.4 特殊命令：为 exit 创建 CommandHandler 导出（handle 返回 void，直接 setState 改 phase）
- [x] 3.5 异步命令：为 status 创建 CommandHandler 导出（handle 返回 Promise，async 获取 engine 状态）
- [x] 3.6 子命令：为 evolve 创建 CommandHandler 导出，含 subcommands（status / rollback）和默认 handler

## 4. 命令聚合注册

- [x] 4.1 创建 `src/cli/commands/index.ts`，聚合所有命令的 handler 并调用 registerCommand 注册到注册表

## 5. App.tsx 重写

- [x] 5.1 从 app.tsx 中提取 `closeInteractive`、`handleCreateComplete`、`handleUseComplete`、`handleRecallResults` 等回调到 CommandContext 构造
- [x] 5.2 将 handleInput 的 switch-case 替换为 `dispatch(parsed, ctx)` 调用，保留 natural input 对话流逻辑不变
- [x] 5.3 清理 app.tsx 中不再需要的 command 组件 import

## 6. 验证

- [x] 6.1 运行 `bun run build` 确认类型检查通过
- [x] 6.2 运行 `bun run test` 确认现有单元测试和组件测试通过
- [x] 6.3 运行 `bun run test:e2e` 确认 E2E 场景行为不变（11/12 pass，唯一失败 Scenario 10 为已有问题）
