## 1. Monorepo 基础设施

- [x] 1.1 根 `package.json` 添加 `"workspaces": ["packages/*"]`
- [x] 1.2 `tsconfig.json` 添加 `"exclude": ["packages"]`
- [x] 1.3 `.gitignore` 添加 `src/export/state/viewer-bundle.ts`

## 2. Viewer workspace 初始化

- [x] 2.1 创建 `packages/viewer/package.json`（react-router, vite, @vitejs/plugin-react 等依赖）
- [x] 2.2 创建 `packages/viewer/vite.config.ts`（React 插件 + dev 模式 API proxy 配置）
- [x] 2.3 创建 `packages/viewer/tsconfig.json`
- [x] 2.4 创建 `packages/viewer/index.html` 入口
- [x] 2.5 执行 `bun install` 验证 workspace 依赖安装正常

## 3. Viewer 前端 — 共享基础

- [x] 3.1 创建 `packages/viewer/src/main.tsx`（React 入口 + Router）
- [x] 3.2 创建 `packages/viewer/src/shared/theme.ts`（赛博朋克色彩，同步 `src/cli/animation/colors.ts`）
- [x] 3.3 创建 `packages/viewer/src/shared/Layout.tsx`（通用页面布局 — header + 容器）
- [x] 3.4 创建 `packages/viewer/src/shared/hooks/useSSE.ts`（通用 SSE EventSource hook）

## 4. Viewer 前端 — 分支树 view 迁移

- [x] 4.1 创建 `packages/viewer/src/views/tree/TreeView.tsx`（主视图，从 tree-html.ts 迁移布局和连线逻辑）
- [x] 4.2 创建 `packages/viewer/src/views/tree/SceneNode.tsx`（场景节点组件，含 gate 菱形样式）
- [x] 4.3 创建 `packages/viewer/src/views/tree/StatsPanel.tsx`（右上角统计面板）
- [x] 4.4 创建 `packages/viewer/src/views/tree/Legend.tsx`（底部图例，含动态路由色块）
- [x] 4.5 创建 `packages/viewer/src/views/tree/Tooltip.tsx`（悬浮提示组件）
- [x] 4.6 验证 `vite build` 产出正确的静态文件

## 5. Viewer server 重构

- [x] 5.1 新建 `src/export/state/viewer-server.ts`，实现 `startProductionServer()` 和 `startDevServer()` 双入口
- [x] 5.2 `startProductionServer()`：从 viewer-bundle.ts 读取内嵌文件，serve 静态 + API 端点（/api/data, /api/events, /api/switch）
- [x] 5.3 `startDevServer()`：动态 `import('vite')`，`createServer()` 启动 dev server，同一进程中挂载 API 端点
- [x] 5.4 将 `tree-server.ts` 中的数据加载逻辑（`loadTreeData`）和文件监听逻辑（`watchSaveDir`）提取为独立模块 `viewer-data.ts`

## 6. CLI 集成

- [x] 6.1 在 `main.ts` 注册 `viewer` 子命令（`viewer <view-name> <script-id>`），调用 `startProductionServer()`
- [x] 6.2 保留 `tree` 子命令作为 `viewer tree` 的别名（现有 handler 不变）
- [x] 6.3 根 `package.json` 添加 `"dev:viewer": "bun src/export/state/viewer-server.ts"` 脚本
- [x] 6.4 更新 `src/export/spec/skill-template.ts` 中 Phase 2 的 tree 启动命令为 `soulkiller runtime viewer tree`

## 7. 构建流程

- [x] 7.1 在 `scripts/build.ts` Phase 1 之前添加 Phase 0：执行 `packages/viewer` 的 vite build
- [x] 7.2 在 `scripts/build.ts` 添加 Phase 0.5：读取 `packages/viewer/dist/` 生成 `src/export/state/viewer-bundle.ts` barrel 模块
- [x] 7.3 验证 `bun run build:release` 完整构建流程正常

## 8. 清理

- [x] 8.1 删除 `src/export/state/tree-html.ts`
- [x] 8.2 删除 `src/export/state/tree-server.ts`（已被 viewer-server.ts 和 viewer-data.ts 替代）
- [x] 8.3 更新 `src/export/state/tree.ts` 中的进程启动逻辑，指向 viewer-server
