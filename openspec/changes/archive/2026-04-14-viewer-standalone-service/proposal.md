## Why

当前 viewer 的分发方式是把 React 应用序列化为 TypeScript 字符串常量（viewer-bundle.ts），编译进 soulkiller 二进制。这导致：构建流程脆弱（Phase 0 → 0.5 → 1 时序依赖）、模板转义容易出 bug、动态/静态 import 导致 Bun.build 行为不确定、process.exit 杀死 in-process server。这不是正常的 monorepo 模式——viewer 是独立渲染服务，应该作为独立静态文件分发。

## What Changes

- **删除 barrel hack**：移除 `viewer-bundle.ts`、build.ts 的 Phase 0.5（barrel 生成）
- **viewer 静态文件随二进制分发**：release 归档包含 `viewer/` 目录，安装到 `~/.soulkiller/viewer/`
- **viewer-server 从磁盘 serve 静态文件**：`Bun.file()` 替代字符串 `new Response()`
- **viewer 作为 detached 进程运行**：恢复 spawn detached 模式，避免 process.exit 杀死 server
- **安装脚本适配**：解压时创建 `~/.soulkiller/viewer/`
- **updater 适配**：更新时也更新 viewer/ 目录
- **build.ts 适配**：vite build 产物直接进归档，不再序列化为字符串

## Capabilities

### Modified Capabilities

- `runtime-viewer`: 从 barrel import 改为磁盘静态文件 serve + detached 进程
- `build-script`: 删除 Phase 0.5，归档结构从单文件改为目录
- `install-script`: 安装逻辑适配包含 viewer/ 的归档
- `self-update`: 更新时解压 viewer/ 目录

## Impact

- 删除文件：`src/export/state/viewer-bundle.ts`
- 修改文件：`viewer-server.ts`、`tree.ts`、`main.ts`、`build.ts`、`install.sh`、`install.ps1`、`updater.ts`、`.gitignore`
- release 归档体积增加 ~250 KB（viewer 静态文件，之前是编译进二进制的所以总体积不变）
- 安装目录新增 `~/.soulkiller/viewer/`
