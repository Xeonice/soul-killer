## Context

当前 skill runtime 的调用链：`SKILL.md → bash runtime/bin/state → bun → main.ts`。三层中间层（bash wrapper + doctor.sh + 独立 bun）全部是 Unix-only，Windows 完全不可用。

实测验证：`bun build --compile` 产出的二进制通过 `BUN_BE_BUN=1` 环境变量 + `process.argv[0]` 可以执行任意外部 `.ts` 文件（包括有相对 import 的多文件模块）。这意味着 soulkiller 二进制本身就是一个跨平台的 bun runtime。

## Goals / Non-Goals

**Goals:**
- Windows PowerShell / Git Bash 用户可以正常运行 skill 的完整生命周期
- 消除 shell wrapper 依赖，统一所有平台的 state CLI 调用方式
- 消除独立 bun 安装的 bootstrap 流程
- tree server（分支树可视化）的进程管理跨平台兼容

**Non-Goals:**
- 不改 `runtime/lib/*.ts` 模块的内部逻辑（apply、validate、schema 等）
- 不改 script.json / state.yaml / meta.yaml 的数据格式
- 不把 state CLI 编译进 soulkiller 二进制（保持 spawn 方式，runtime 版本跟 skill 走）

## Decisions

### 1. 入口：src/index.tsx 拦截 `runtime` 子命令

在 `--version` / `--update` 之后、`render(<App/>)` 之前：

```typescript
if (args[0] === 'runtime') {
  const { runRuntime } = await import('./cli/runtime.js')
  const code = await runRuntime(args.slice(1))
  process.exit(code)
}
```

新建 `src/cli/runtime.ts`，职责单一：

```typescript
export async function runRuntime(args: string[]): Promise<number> {
  // --root 手动覆盖，方便开发调试
  let skillRoot: string | undefined
  const filteredArgs = [...args]
  const rootIdx = filteredArgs.indexOf('--root')
  if (rootIdx >= 0 && filteredArgs[rootIdx + 1]) {
    skillRoot = filteredArgs[rootIdx + 1]
    filteredArgs.splice(rootIdx, 2)
  }
  skillRoot ??= process.env.CLAUDE_SKILL_DIR

  if (!skillRoot) {
    process.stderr.write('error: CLAUDE_SKILL_DIR not set (pass --root <path> for manual use)\n')
    return 1
  }

  const mainTs = join(skillRoot, 'runtime', 'lib', 'main.ts')
  if (!existsSync(mainTs)) {
    process.stderr.write(`error: ${mainTs} not found\n`)
    return 1
  }

  // spawn 自身执行外部 .ts
  // 注意：必须用 process.execPath 而非 process.argv[0]。
  // bun build --compile 产出的二进制中 process.argv[0] 是 "bun"（短名），
  // 而 process.execPath 才是二进制的真实绝对路径。
  // 在没装系统 bun 的 Windows 上，spawn("bun", ...) 会因找不到命令而失败。
  const child = spawn(process.execPath, [mainTs, ...filteredArgs], {
    env: { ...process.env, BUN_BE_BUN: '1', SKILL_ROOT: skillRoot },
    stdio: 'inherit',
  })

  return new Promise((resolve) => {
    child.on('exit', (code) => resolve(code ?? 1))
  })
}
```

不用 dynamic import `main.ts`，用 spawn。原因：
- runtime 版本跟 skill archive 走，不同 skill 可以有不同版本的 `runtime/lib/`
- 避免 soulkiller 主进程的 ink/React 上下文污染 state CLI 的 stdout
- 未来 skill 的 runtime 可以独立演进，不需要跟 soulkiller 发版同步

### 2. doctor 子命令重新定义

`soulkiller runtime doctor` 不再检测 bun 存在性（已内嵌）和平台（能跑就支持）。

`main.ts` 的 doctor 分支已有一个 trivial 实现（直接输出 OK），扩展为：

```
STATUS: OK
SOULKILLER_VERSION: 0.5.0
BUN_VERSION: 1.1.38
PLATFORM: win32-x64
```

PLATFORM 用 `process.platform + '-' + process.arch`（Node/Bun 标准值，跨平台一致）。

Phase -1 Step 0 检测 "soulkiller not found" 的方式：LLM 执行 `soulkiller runtime doctor`，如果命令不存在（exit code 非 0 或 stderr 含 "not found"），则提示安装。

### 3. SKILL.md 模板改造

#### 3.1 调用格式

所有 `bash ${CLAUDE_SKILL_DIR}/runtime/bin/state <subcommand>` 替换为：

```
soulkiller runtime <subcommand>
```

CLAUDE_SKILL_DIR 不再出现在调用中（由 runtime.ts 内部从环境变量读取）。

#### 3.2 Platform Notice

```markdown
# Platform Scope

This skill requires soulkiller to be installed. Supported platforms:

- macOS (Apple Silicon / Intel)
- Linux (x86_64 / arm64)
- Windows (x64)

If `soulkiller` is not available, Phase -1 Step 0 will provide installation instructions.
```

#### 3.3 Phase -1 Step 0

```markdown
## Step 0: Runtime Health Check

Run: `soulkiller runtime doctor`

### Command succeeds (STATUS: OK)
Proceed to Step -1.1.

### Command not found
soulkiller is not installed. Use AskUserQuestion:

"This skill requires the soulkiller CLI. One-time installation:

- macOS/Linux: curl -fsSL https://raw.githubusercontent.com/Xeonice/soul-killer/main/scripts/install.sh | sh
- Windows: irm https://raw.githubusercontent.com/Xeonice/soul-killer/main/scripts/install.ps1 | iex

After installation, open a new terminal and retry."

Options: "I've installed it" / "Cancel (enter read-only mode)"
```

### 4. tree server 跨平台进程管理

`tree.ts` 改动：

**启动**：`spawn('bun', [serverScript], ...)` 改为 `spawn(process.execPath, [serverScript], { env: { ...process.env, BUN_BE_BUN: '1' } })`。

`tree.ts` 是被 `main.ts` 调用的，而 `main.ts` 是被 soulkiller spawn 执行的——此时 `process.execPath` 指向 soulkiller 二进制（实测验证：三层 spawn 链中 `process.execPath` 始终返回编译二进制的绝对路径），可以直接复用。

注意：必须用 `process.execPath` 而非 `process.argv[0]`。后者在编译二进制中返回 `"bun"` 短名，spawn 时会尝试在 PATH 中查找 `bun`，在没装系统 bun 的 Windows 上直接失败。

**终止**：

```typescript
function killProcess(pid: number): void {
  try {
    if (process.platform === 'win32') {
      execSync(`taskkill /pid ${pid} /f /t`, { stdio: 'ignore' })
    } else {
      process.kill(pid, 'SIGTERM')
    }
  } catch { /* ignore */ }
}
```

**isProcessAlive**：`process.kill(pid, 0)` 在 Windows 上也工作（Bun/Node 内部用 OpenProcess 实现），无需修改。

### 5. packager.ts 简化

`injectRuntimeFiles` 函数：
- 删除 `doctor.sh` 打包逻辑
- 删除 `state.sh → runtime/bin/state` 打包逻辑
- 删除 `execPaths` 集合（不再有需要可执行位的文件）
- 只保留 `runtime/lib/*.ts` 的复制（和现在一样）

返回值从 `Set<string>`（可执行路径集合）改为 `void` 或直接内联。

### 6. lint 规则

`lint-skill-template.ts`：

```typescript
// 现在
const doctorMarker = 'runtime/bin/state doctor'
const applyMarker = 'runtime/bin/state apply'

// 改为
const doctorMarker = 'soulkiller runtime doctor'
const applyMarker = 'soulkiller runtime apply'
```

`NO_EDIT_STATE_YAML` 规则不变（仍然禁止直接 Edit state.yaml）。

## Risks / Trade-offs

| 风险 | 严重度 | 缓解 |
|------|--------|------|
| BUN_BE_BUN 在未来 bun 版本中行为变化 | 低 | bun 官方文档记录的特性；state 模块只用 node:fs/path/JSON 等极稳定 API |
| 用户 PATH 中 soulkiller 不存在 | 中 | Phase -1 Step 0 明确检测 + 跨平台安装指引 |
| spawn 额外开销（vs direct import） | 极低 | 进程启动 <100ms，相比 LLM 轮次的秒级延迟可忽略 |
| packager 改动导致旧 skill 不兼容 | 无 | 旧 skill 仍有 bash wrapper，新 skill 用 soulkiller runtime，互不干扰 |
| Windows 上 taskkill 行为差异 | 低 | tree server 是辅助功能，即使失败不影响核心 gameplay |
