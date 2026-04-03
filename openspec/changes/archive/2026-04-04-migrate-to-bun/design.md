## Context

当前项目使用 Node.js 20 + npm 作为运行时和包管理器。E2E 测试通过 node-pty（C++ 原生模块）创建 PTY，需要三层架构：test-terminal.ts → fork() IPC → pty-host.cjs → node-pty.spawn()。这导致 CI 需要安装 build-essential 编译原生模块，且 ink v6 在 CI=true 环境下的渲染行为已经造成了稳定性问题。

## Goals / Non-Goals

**Goals:**
- 运行时、包管理、构建、测试、CI 全部统一到 Bun
- E2E 测试 harness 用 Bun 原生 PTY API 替代 node-pty，消除原生编译依赖
- CI 流水线仅依赖 Bun，不安装 Node.js
- 保持所有 E2E 场景代码、单元测试、组件测试的测试逻辑不变

**Non-Goals:**
- 不将 vitest 替换为 bun:test（保留 vitest，用 bun 跑）
- 不重写业务代码
- 不做 `bun build --compile` 单文件二进制分发（后续独立变更）

## Decisions

### D1: E2E PTY 方案 — Bun.spawn + terminal

**选择**: 使用 `Bun.spawn()` 的 `terminal` 选项创建 PTY

**替代方案**:
- `@skitee3000/bun-pty` (FFI 绑定) — 引入额外依赖，且成熟度未知
- 保留 node-pty 仅 E2E 用 Node 跑 — 违背全面统一的目标

**理由**: Bun.spawn terminal 是官方原生 API，零依赖，POSIX 系统全支持。CI 在 Linux (ubuntu-latest) 和本地 macOS 上都是 POSIX，无 Windows 需求。

**架构变化**:
```
现在: TestTerminal → fork(pty-host.cjs) → node-pty.spawn() → 子进程
迁移: TestTerminal → Bun.spawn({ terminal }) → 子进程
```

TestTerminal 从 IPC 消息驱动改为直接持有 Bun 子进程的 terminal 对象。公开 API（waitFor、send、sendKey 等）保持不变，scenarios.test.ts 零改动。

### D2: 测试框架 — 保留 vitest

**选择**: 保留 vitest，通过 `bun vitest run` 执行

**替代方案**:
- 全换 bun:test — 需要重写所有 import、4 套配置、ink-testing-library 兼容性未知

**理由**: vitest 在 Bun 下运行良好，保留可最小化改动范围。测试代码零改动。

### D3: 构建策略 — bun 直接运行 TS

**选择**: 
- 开发: `bun src/index.tsx`（替代 tsx）
- 类型检查: `tsc --noEmit`（保留 tsconfig.json）
- E2E: `bun src/index.tsx`（无需预编译 dist/）

**理由**: Bun 原生支持 TypeScript，无需编译步骤。tsc 仅保留用于类型检查，不产出 JS 文件。E2E 不再需要 `npm run build` 预编译步骤。

### D4: package.json scripts 映射

```
"dev":              "bun src/index.tsx"
"build":            "tsc --noEmit"          (仅类型检查)
"test":             "bun vitest run"
"test:watch":       "bun vitest"
"test:visual":      "bun vitest run --config vitest.visual.config.ts"
"test:integration": "bun vitest run --config vitest.integration.config.ts"
"test:e2e":         "E2E_DEBUG=1 bun vitest run --config vitest.e2e.config.ts --reporter=verbose"
```

### D5: CI 简化

```yaml
# 每个 job 统一为:
- uses: oven-sh/setup-bun@v2
  with: { bun-version: latest }
- run: bun install
- run: bun run test  # 或其他 test script
```

删除: `setup-node`、`apt-get build-essential`、`verify-pty.cjs`、`npm run build` 步骤。

## Risks / Trade-offs

**[Bun.spawn terminal API 行为差异]** → 写完 harness 后立即跑全部 10 个 E2E 场景验证；若输出格式有差异，在 TestTerminal 内部适配，不改 scenarios

**[vitest pool: 'forks' 在 Bun 下的行为]** → E2E config 用 forks 隔离，需要验证 Bun 是否正确支持。备选: 改为 pool: 'threads' 或移除 pool 配置

**[ink-testing-library 兼容性]** → component 测试依赖此库，需要验证。通常 ink v6 官方支持 Bun，其测试库应无问题

**[bun.lock vs package-lock.json]** → 切换后其他开发者需要安装 Bun。在 README 中说明即可
