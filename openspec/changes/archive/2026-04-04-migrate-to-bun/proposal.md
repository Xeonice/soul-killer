## Why

将整个项目的运行时、包管理、构建、测试、CI 从 Node.js + npm 全面切换到 Bun。主要动机：安装速度提升 5x、开发冷启动提升 4x、消除 node-pty 原生模块编译依赖（CI 不再需要 build-essential）、支持 `bun build --compile` 产出单文件二进制分发。

## What Changes

- **BREAKING**: 运行时从 Node.js 20 切换到 Bun，`package-lock.json` 替换为 `bun.lock`
- **BREAKING**: E2E 测试 harness 从 node-pty + IPC 架构重写为 Bun.spawn + terminal 直连
- 删除 `node-pty`、`tsx` devDependencies
- 删除 `pty-host.cjs`、`verify-pty.cjs` 中间层文件
- package.json scripts 全部改为 `bun` 命令
- CI workflow 从 `setup-node` + `npm` 切换到 `setup-bun` + `bun`
- 入口 shebang 改为 `#!/usr/bin/env bun`
- 构建产物支持 `bun build --compile` 单文件二进制

## Capabilities

### New Capabilities
- `bun-pty-harness`: Bun 原生 PTY 测试 harness，用 Bun.spawn terminal API 替代 node-pty + IPC 架构

### Modified Capabilities
- `e2e-test-harness`: TestTerminal 内部实现从 fork+IPC+node-pty 改为 Bun.spawn+terminal 直连，公开 API 保持不变

## Impact

- **依赖变化**: 移除 `node-pty` (原生 C++ 模块)、`tsx` (开发运行器)；lockfile 从 npm 切换到 bun
- **CI 变化**: `.github/workflows/ci.yml` 全面重写，删除 build-essential 安装步骤和 node-pty 验证步骤
- **E2E 测试**: `tests/e2e/harness/` 目录重构 — 删除 pty-host.cjs、verify-pty.cjs，重写 test-terminal.ts
- **构建**: `tsc` 仍保留用于类型检查（`tsc --noEmit`），实际运行和构建由 bun 接管
- **入口**: `src/index.tsx` shebang 更新
- **零影响**: 所有业务代码、E2E 场景代码、单元测试、组件测试、集成测试的测试逻辑不变
