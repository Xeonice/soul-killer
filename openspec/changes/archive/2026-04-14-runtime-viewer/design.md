## Context

soulkiller 是单二进制分发的 CLI 工具。当前分支树可视化通过 `tree-server.ts`（Bun.serve）启动 HTTP server，`tree-html.ts` 返回内嵌在字符串模板中的完整 HTML 页面。SSE 推送实时更新。该架构可用但不可维护——400 行前端代码无类型检查、无组件化、无热更新。

项目当前是单包结构（无 workspace），构建流程为 `Bun.build() → bun build --compile → tar.gz`。

## Goals / Non-Goals

**Goals:**
- 将前端从字符串模板迁移到 Vite + React 独立项目，保留所有现有功能
- 建立通用 viewer 架构，支持未来新增 view（路由 `/tree`、`/stats` 等）
- 开发时一条命令 `bun run dev:viewer` 启动 vite dev（HMR）+ API proxy
- 生产时前端产物以字符串常量形式打包进 soulkiller 二进制，零运行时文件依赖
- 项目转为 bun workspace monorepo

**Non-Goals:**
- 不改变 SSE 实时更新机制（保持 `/events` 端点）
- 不改变 CI workflow 文件（bun install + build.ts 内部处理）
- 不在本次添加新的 view（只迁移分支树）
- 不将 viewer 相关文件打包进 .skill 归档

## Decisions

### Decision 1: 前端产物打包为 barrel 模块嵌入二进制

构建时 `vite build` 产出 `dist/index.html` + `dist/assets/*`，由 `build.ts` 读取所有文件生成一个 TypeScript barrel 模块：

```ts
// src/export/state/viewer-bundle.ts (自动生成, gitignore)
export const files: Record<string, { content: string; mime: string }> = {
  "/": { content: "<!DOCTYPE html>...", mime: "text/html" },
  "/assets/main-abc123.js": { content: "...", mime: "application/javascript" },
  "/assets/main-abc123.css": { content: "...", mime: "text/css" },
}
```

`Bun.build()` 打包时 import 这些字符串常量，最终编译进单二进制。

**备选**: `--assets-dir` 外挂静态文件 → 破坏单文件分发原则，排除。

**备选**: `Bun.file()` 运行时读取 → 需要文件系统，排除。

### Decision 2: 开发/生产双入口

```
viewer-server.ts 导出两个函数:
  startProductionServer(skillRoot, viewName, scriptId)
    → serve 内嵌静态文件 + API 端点

  startDevServer(skillRoot, viewName, scriptId)
    → 动态 import('vite'), createServer(), 配置 proxy
    → 同一个进程内提供 API

生产入口: main.ts → if (sub === 'viewer') → startProductionServer()
开发入口: viewer-server.ts import.meta.main → startDevServer()
```

package.json 新增:
```json
"dev:viewer": "bun src/export/state/viewer-server.ts"
```

用法: `bun run dev:viewer tree <script-id>`

### Decision 3: Monorepo workspace 配置

根 `package.json` 添加:
```json
"workspaces": ["packages/*"]
```

`packages/viewer/package.json` 声明自己的依赖（vite、@vitejs/plugin-react、react-router）。`react` 和 `react-dom` 从根 workspace 提升。

`tsconfig.json` 添加 `"exclude": ["packages"]` 避免根 tsc 检查 viewer。

### Decision 4: 构建流程扩展

`build.ts` 新增两个阶段在 Phase 1 (Bundle) 之前:

```
Phase 0: Viewer Build
  execSync('bun run --cwd packages/viewer build')
  → packages/viewer/dist/

Phase 0.5: Generate Barrel
  读取 dist/ 下所有文件 → 生成 src/export/state/viewer-bundle.ts

Phase 1: Bundle (现有，不变)
  Bun.build(src/index.tsx) → import viewer-bundle.ts → 一起打包
```

### Decision 5: CLI 命令结构

```
soulkiller runtime viewer <view-name> <script-id>
```

当前只有 `tree` view。viewer-server 内部根据 view-name 选择数据 loader。

旧命令 `soulkiller runtime tree` 需要保留兼容别名一段时间，或直接在 SKILL.md 模板更新中切换。

### Decision 6: viewer 前端路由结构

```
packages/viewer/src/
  ├── main.tsx              → React 入口 + Router
  ├── router.tsx            → 路由定义
  ├── shared/
  │   ├── theme.ts          → 赛博朋克色彩 (从 colors.ts 同步)
  │   ├── Layout.tsx         → 通用 header + 容器
  │   └── hooks/
  │       └── useSSE.ts     → 通用 SSE hook
  └── views/
      └── tree/
          ├── TreeView.tsx   → 主视图（从 tree-html.ts 迁移）
          ├── SceneNode.tsx  → 场景节点组件
          ├── StatsPanel.tsx → 右上角统计面板
          ├── Legend.tsx     → 底部图例
          └── Tooltip.tsx   → 悬浮提示
```

## Risks / Trade-offs

- **[风险] vite 作为 devDependency 增加 install 时间** → 仅在 viewer workspace 中，不影响用户安装 soulkiller 二进制
- **[风险] barrel 模块中的哈希文件名每次构建都变** → viewer-bundle.ts 在 gitignore 中，不影响 git diff；build.ts 每次重新生成
- **[风险] 旧 SKILL.md 使用 `runtime tree` 命令** → 保留 `tree` 作为 `viewer tree` 的别名，下个大版本移除
- **[Trade-off] vite 是运行时 devDependency** → 开发 viewer 时需要，但不进入生产二进制，可接受
- **[Trade-off] 二进制体积增 ~200 KB** → 相对 80 MB 基数可忽略 (+0.25%)
