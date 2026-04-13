## Context

viewer（分支树可视化）当前通过 barrel 模块（viewer-bundle.ts）把整个 React 应用序列化为字符串编译进 soulkiller 二进制。这个 hack 导致多个问题：Bun.build 的动态/静态 import 行为不确定、process.exit 杀死 in-process server、构建时序脆弱。viewer 是独立渲染服务，应按正常 monorepo 模式作为独立静态文件分发。

## Goals / Non-Goals

**Goals:**
- viewer 静态文件（index.html + assets/）随二进制一起分发，安装到 `~/.soulkiller/viewer/`
- `soulkiller runtime viewer tree <script-id>` 拉起 detached HTTP 服务，serve 静态文件 + API
- 开发模式 `bun run dev:viewer` 走 vite dev 不变
- 安装脚本、更新器、CI 构建全链路适配

**Non-Goals:**
- 不改变 viewer 的 React 代码和组件结构
- 不改变 API 端点（/api/data, /api/events, /api/switch）
- 不改变 SSE 实时更新机制

## Decisions

### Decision 1: 安装目录结构

```
~/.soulkiller/
  ├── bin/soulkiller
  └── viewer/
       ├── index.html
       └── assets/
            ├── index-xxx.js
            └── index-xxx.css
```

viewer 路径通过 `join(homedir(), '.soulkiller', 'viewer')` 确定，不可配置。

### Decision 2: 归档结构

```
soulkiller-darwin-arm64.tar.gz
  ├── soulkiller
  └── viewer/
       ├── index.html
       └── assets/...
```

build.ts 在 Phase 3（压缩）时，把 `packages/viewer/dist/` 内容作为 `viewer/` 目录打进 tar.gz。

### Decision 3: viewer-server 从磁盘 serve

```ts
const VIEWER_DIR = join(homedir(), '.soulkiller', 'viewer')

Bun.serve({
  fetch(req) {
    // API 路由照旧
    // 静态文件：
    const filePath = join(VIEWER_DIR, pathname === '/' ? 'index.html' : pathname)
    const file = Bun.file(filePath)
    if (await file.exists()) return new Response(file)
    // SPA fallback
    return new Response(Bun.file(join(VIEWER_DIR, 'index.html')))
  }
})
```

### Decision 4: 恢复 detached 进程模式

viewer 命令回到 spawn detached 子进程的模式（和原来 tree.ts 一致）：

```
main.ts viewer 子命令
  → spawn detached viewer-server 进程
  → 父进程输出 VIEWER_URL 后正常退出
  → viewer-server 后台运行，2 小时无连接自动退出
```

viewer-server.ts 通过 `import.meta.main` 判断是否作为独立进程运行。

### Decision 5: install.sh 解压逻辑

当前：`tar -xzf archive -C ~/.soulkiller/bin/` 只解压一个 soulkiller 文件。

改为：解压到临时目录，然后分别移动：

```bash
TMP=$(mktemp -d)
tar -xzf archive -C "$TMP"
mv "$TMP/soulkiller" ~/.soulkiller/bin/soulkiller
rm -rf ~/.soulkiller/viewer
mv "$TMP/viewer" ~/.soulkiller/viewer
rm -rf "$TMP"
```

### Decision 6: updater.ts 适配

更新时解压归档后，除了替换二进制，还要替换 viewer/ 目录。逻辑和 install.sh 类似。

## Risks / Trade-offs

- **[风险] viewer/ 目录被用户误删** → viewer-server 启动时检查目录是否存在，缺失则报错提示重新安装
- **[Trade-off] 安装体积略增** → viewer 静态文件 ~250 KB，相对 80 MB 二进制可忽略
- **[Trade-off] 不再是严格单文件** → 但"二进制 + viewer 目录"的结构在 CLI 工具中很常见（如 VS Code 的 resources/）
