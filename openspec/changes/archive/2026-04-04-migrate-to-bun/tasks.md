## 1. 包管理 & 依赖切换

- [x] 1.1 删除 `package-lock.json`，运行 `bun install` 生成 `bun.lock`
- [x] 1.2 从 devDependencies 移除 `node-pty` 和 `tsx`
- [x] 1.3 更新 package.json scripts（dev/build/test 全部改为 bun 命令）
- [x] 1.4 更新 `src/index.tsx` shebang 为 `#!/usr/bin/env bun`

## 2. E2E Harness 重写

- [x] 2.1 重写 `tests/e2e/harness/test-terminal.ts`：用 Bun.spawn + terminal 替代 fork + IPC + node-pty
- [x] 2.2 删除 `tests/e2e/harness/pty-host.cjs`（IPC 中间层）
- [x] 2.3 删除 `tests/e2e/harness/verify-pty.cjs`（冒烟测试）
- [x] 2.4 更新 `vitest.e2e.config.ts`：移除 node-pty 相关的 externals/deps 配置

## 3. CI Workflow 重写

- [x] 3.1 重写 `.github/workflows/ci.yml`：所有 job 切换到 setup-bun，删除 setup-node、apt-get build-essential、verify-pty、npm run build 步骤

## 4. 验证

- [x] 4.1 本地运行 `bun run dev` 验证 CLI 正常启动
- [x] 4.2 本地运行 `bun run test` 验证单元/组件测试全部通过
- [x] 4.3 本地运行 `bun run test:e2e` 验证 E2E 10 个场景全部通过
- [x] 4.4 本地运行 `bun run test:integration` 验证集成测试通过
- [x] 4.5 模拟 CI 环境（CI=true）运行 E2E 测试验证通过
