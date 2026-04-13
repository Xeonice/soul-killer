## Why

当前 skill runtime 的 state CLI 通过 bash wrapper (`runtime/bin/state`) + 独立安装的 bun 来执行 TypeScript 模块。这个架构在 Windows 上完全不可用：

1. `state.sh` 是 `#!/bin/bash` 脚本，PowerShell 无法执行
2. `doctor.sh` 中 `MINGW*/MSYS*` 被硬拒为 `windows-native`，即使 Claude Code 默认的 Git Bash 也被拦截
3. Bun 的 Unix 安装脚本 (`curl | bash`) 在 Git Bash 下不工作，必须用 PowerShell 安装器
4. PowerShell 安装器不支持 `BUN_INSTALL` 自定义路径，隔离安装到 `.soulkiller-runtime/` 不可行
5. SKILL.md 模板中 37 处写死 `bash runtime/bin/state`，LLM 会忠实执行这个 `bash` 前缀
6. `tree.ts` 使用 `SIGTERM` 管理进程，Windows 无此信号

实际有大量用户在 Windows 原生 PowerShell 环境下使用 Claude Code 运行 skill。

## What Changes

用 soulkiller 二进制本身替代 shell wrapper + 独立 bun 的组合，作为 skill runtime 的执行入口。

### 核心思路

`bun build --compile` 产出的 soulkiller 二进制内嵌完整 bun runtime。通过 `BUN_BE_BUN=1` + `process.argv[0]`，二进制可以执行外部 `.ts` 文件（已实测验证）。因此：

- 用户安装了 soulkiller = 已有跨平台 bun runtime
- 不需要单独安装 bun
- 不需要任何 shell wrapper
- 一个命令 `soulkiller runtime <subcommand>` 在所有平台上行为一致

### 1. soulkiller 二进制新增 `runtime` 子命令

`src/index.tsx` 在 `--version` / `--update` 之后、`render(<App/>)` 之前拦截 `runtime` 子命令：

```
soulkiller runtime <subcommand> [args...]
```

内部实现：spawn 自身（`process.execPath`，注意不是 `process.argv[0]`——后者在编译二进制中返回 `"bun"` 短名）+ `BUN_BE_BUN=1` 环境变量，执行 `$CLAUDE_SKILL_DIR/runtime/lib/main.ts`。SKILL_ROOT 从 `CLAUDE_SKILL_DIR` 环境变量获取（Claude Code skill 框架标准变量），支持 `--root` 手动覆盖用于开发调试。

选择 spawn 而非 direct import 的原因：runtime 版本跟 skill archive 走而非跟 soulkiller 版本走，不同 skill 可以有不同版本的 runtime，向后兼容性更好。

### 2. SKILL.md 模板统一调用方式

37 处 `bash ${CLAUDE_SKILL_DIR}/runtime/bin/state <subcommand>` 全部替换为：

```
soulkiller runtime <subcommand>
```

不需要平台分支、不需要 STATE_PREFIX 间接引用、不需要 doctor 平台检测。

### 3. Phase -1 doctor 简化

`soulkiller runtime doctor` 替代 `bash runtime/bin/state doctor`：

- 不再检测平台（soulkiller 能跑 = 平台支持）
- 不再检测 bun（soulkiller 自带）
- 只输出 soulkiller 版本 + bun 版本用于调试

Phase -1 Step 0 的 "soulkiller not found" 分支提供安装指引：
- macOS/Linux: `curl -fsSL .../install.sh | sh`
- Windows: `irm .../install.ps1 | iex`

### 4. 删除 shell wrapper

- 删除 `src/export/state/state.sh`
- 删除 `src/export/state/doctor.sh`
- `packager.ts` 不再打包 `.sh` 文件、不再设置可执行位
- `runtime/lib/*.ts` 保留在 skill archive 中（被 spawn 执行）

### 5. tree server 进程管理统一

`tree.ts` 中的 `spawn('bun', ...)` 改为 spawn soulkiller 自身（`process.execPath` + `BUN_BE_BUN=1`）来启动 `tree-server.ts`。进程终止改为跨平台方式：

```typescript
if (process.platform === 'win32') {
  execSync(`taskkill /pid ${pid} /f /t`, { stdio: 'ignore' })
} else {
  process.kill(pid, 'SIGTERM')
}
```

### 6. lint 规则适配

`lint-skill-template.ts` 中的 marker 检测从 `runtime/bin/state doctor` / `runtime/bin/state apply` 改为 `soulkiller runtime doctor` / `soulkiller runtime apply`。

## Capabilities

### New Capabilities
- `skill-runtime-binary`: soulkiller 二进制作为 skill runtime 执行入口，跨平台统一

### Modified Capabilities
- `skill-runtime-bun-state`: 调用方式从 bash wrapper 改为 soulkiller 二进制
- `export-packager`: 不再打包 shell wrapper，简化打包流程
- `skill-template`: 所有 state CLI 调用统一为 `soulkiller runtime`

### Removed Capabilities
- `doctor-bootstrap`: 不再需要独立的 bun 安装引导流程

## Impact

- **新增**: `src/cli/runtime.ts`（~40 行）+ `src/index.tsx` 中 `runtime` 子命令拦截（~4 行）
- **删除**: `src/export/state/state.sh`、`src/export/state/doctor.sh`
- **修改**:
  - `src/export/spec/skill-template.ts` — 37 处调用替换 + Phase -1 doctor 简化 + Platform Notice 更新
  - `src/export/packager.ts` — 移除 shell wrapper 打包逻辑
  - `src/export/support/lint-skill-template.ts` — lint marker 更新
  - `src/export/state/tree.ts` — spawn/kill 跨平台处理
- **不改**: `src/export/state/main.ts` 及所有 `runtime/lib/*.ts` 模块（保持不变，仍由 spawn 执行）
- **前置条件变更**: 用户从 "需要 Unix shell + 独立 bun" 变为 "需要安装 soulkiller 二进制"

## Risks

| 风险 | 严重度 | 缓解 |
|------|--------|------|
| 用户未安装 soulkiller | 中 | Phase -1 Step 0 检测 + 提供跨平台安装指引 |
| BUN_BE_BUN 行为在未来 bun 版本中变化 | 低 | state 模块只用 node:fs/path/JSON — 极稳定 API |
| soulkiller 二进制版本与 skill 的 runtime .ts 不兼容 | 低 | spawn 方式保证 runtime 版本跟 skill 走；API 表面（node:fs/path）极稳定 |
| 需要 Windows CI 验证 | 中 | 新增 windows-latest CI job 做冒烟测试 |
