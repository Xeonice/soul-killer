## Why

当前的分支树可视化（`tree-server.ts` + `tree-html.ts`）将 ~400 行 HTML/CSS/JS 内嵌在一个 TypeScript 字符串模板中，没有类型检查、没有组件化、没有热更新，维护困难。同时分支树只是第一个可视化场景，未来还会有状态面板、角色关系图等需求，需要一个可扩展的通用渲染服务架构。

## What Changes

- **新增 `packages/viewer` workspace**：独立的 Vite + React 项目，包含分支树可视化（从内嵌字符串迁移）和通用路由架构
- **新增构建步骤**：`build.ts` 在编译前先执行 `vite build`，将产物生成为 barrel 模块（字符串常量）打包进二进制
- **项目转为 monorepo**：根 `package.json` 添加 `workspaces: ["packages/*"]`
- **重构 viewer-server**：生产模式 serve 内嵌静态文件 + API，开发模式通过 `bun run dev:viewer` 启动 vite dev server + API proxy
- **删除 `tree-html.ts`**：被 React 组件替代
- **重命名 CLI 子命令**：`soulkiller runtime tree` → `soulkiller runtime viewer tree`

## Capabilities

### New Capabilities

- `runtime-viewer`: 通用可视化渲染服务，支持多 view 路由，首个 view 为分支树

### Modified Capabilities

- `branch-tree-server`: 分支树从内嵌 HTML 字符串迁移为 React 组件，API 端点和 SSE 实时更新保持不变
- `build-script`: 构建流程新增 vite build 前置步骤和 barrel 模块生成

## Impact

- 新增依赖：`vite`、`@vitejs/plugin-react`、`react-router`（仅在 viewer workspace 的 devDependencies）
- 项目结构变更：单包 → monorepo workspace
- CLI 命令变更：`soulkiller runtime tree <script-id>` → `soulkiller runtime viewer tree <script-id>`（**BREAKING**：SKILL.md 模板需同步更新）
- 构建时间：新增 vite build 步骤（~2-3 秒）
- 二进制体积：增加 ~200 KB（React + 应用代码的字符串常量）
