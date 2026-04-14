## Context

`src/cli/updater.ts:223-237` 当前替换逻辑：

```typescript
try {
  chmodSync(extractedBinary, 0o755)
  renameSync(extractedBinary, execPath)   // Windows: EBUSY
} catch {
  writeFileSync(execPath, Buffer.from(...)) // Windows: 同样 EBUSY
  chmodSync(execPath, 0o755)
}
```

POSIX 下 `rename(2)` 允许原子覆盖运行中的文件（unlink 后 inode 继续保留到进程退出），Windows 的 `MoveFileEx` 遇到 target 正在执行时返回 `ERROR_SHARING_VIOLATION`。两条 fallback 路径都踩同一块石头。

Deno 走的路线（`cli/tools/upgrade.rs`）：利用 Windows 一个怪癖——**运行中的 exe 不能写、不能删，但可以 rename**。这是 MSI installer、Chrome Updater、Chocolatey 都在用的同一个技巧。重命名后原路径腾空，新文件落到原路径即可。

Bun 自己的 `bun upgrade` 也用这个模式，但在两种边缘情况下翻过车：
- Issue #15279：安装目录是符号链接（e.g. 用户用 `mklink /D` 把 `AppData\Local\soulkiller` 映射到别的盘），rename 跨卷失败
- Issue #10114：用户开了两个 bun 进程，第二个进程的文件锁让 rename 失败

这两个坑在我们的实现里 **可预防**，只需在 rename 前规范化路径 + 对 rename 失败给出明确错误分类。

## Goals / Non-Goals

**Goals:**
- Windows 下 `soulkiller --update` 能成功替换二进制（最核心）
- 替换失败时不损坏已有二进制（用户始终能回到一个可运行状态）
- Bun 两个历史坑（symlink、并发进程）给出可诊断的错误信息
- 补上 checksum 验证（当前代码 fetch 了 `checksums.txt` 但只用于版本比对，没在替换前校验下载包内容）

**Non-Goals:**
- 引入独立的 updater 二进制（评估过，见 proposal / 历史 explore 会话）
- 改变 CI 发布流程或 R2 产物格式
- 支持 auto-relaunch（第一版先不做，见决策 3）
- 修复已经装了 v0.3.7 及之前 Windows 版本的用户的升级问题——他们仍需重装一次。只保证下次升级起生效。

## Decisions

### 决策 0：把替换逻辑收敛成一个 `atomicReplaceBinary` 原语

**选择**：不给 `runUpdate` 主流程再加第三条 `if isWindows` 分支，而是把"把一个文件原子替换到目标可执行路径"抽成一个独立函数：

```typescript
// updater.ts
interface ReplaceResult { ok: true } | { ok: false; reason: ReplaceFailure }
type ReplaceFailure =
  | { code: 'LOCKED';     message: string }  // 其他进程持锁 / EBUSY
  | { code: 'PERMISSION'; message: string }  // 权限 / 只读
  | { code: 'DISK_FULL';  message: string }  // ENOSPC
  | { code: 'UNKNOWN';    message: string; cause: Error }

async function atomicReplaceBinary(
  src: string,
  dst: string
): Promise<ReplaceResult>
```

内部结构：

```
atomicReplaceBinary(src, dst):
  dst = realpath(dst)                     # 决策 5：规避 symlink 坑

  if isWindows:
    try rename(dst, dst+'.old')           # 决策 1：rename-self
    if fail -> LOCKED (提示关其他 REPL)
    try writeFileSync(dst, read(src))
    if fail -> try rename(dst+'.old', dst)  # rollback
             -> DISK_FULL/PERMISSION
  else:
    try rename(src, dst)                  # 现有快路径
    if EXDEV:
      try writeFileSync(dst, read(src))   # 现有 fallback
      if fail -> PERMISSION/DISK_FULL
```

`runUpdate` 主流程调用点简化到一行：

```typescript
const result = await atomicReplaceBinary(extractedBinary, process.execPath)
if (!result.ok) {
  reportReplaceFailure(result.reason)   // 统一的错误文案
  process.exitCode = 1
  return
}
```

**替代方案**：
- 保留当前 `try { rename } catch { read+write }` 结构，在 catch 块里再加 Windows 分支：catch 级嵌套三层，语义更乱，测试也难分支覆盖
- 直接三段 if/else 并列在 `runUpdate`：跟现有函数的字段 / 临时状态耦合太紧，测试必须跑整个 `runUpdate`

**理由**：
- 把"原子替换"的关注点从升级流程里剥离，可以被独立单元测试（mock fs 即可）
- 错误分类上升为 typed result，调用方按 code 分流提示文案，而不是全 catch 成 string
- 将来如果有其他地方需要替换 binary（比如未来做 `soulkiller rollback`），可以复用这个原语

### 决策 1：Windows 替换使用 rename-self，不用 bat 脚本 / 独立 updater

**选择**：Windows 分支走
```
realpath(execPath)              // 防 symlink 坑
rename(exe, exe + '.old')        // Windows 允许 rename 自己
writeFileSync(exe, newBinary)    // 原路径已空
```

**替代方案**：
- bat 脚本 detach：有黑窗口闪现、中文路径 / 反斜杠转义坑、竞态（sleep 1s 不够时失败）
- 独立 Rust updater：引入 cargo + cross-compile + updater 自升级套娃，复杂度远超问题

**理由**：
- Deno 跑几年没翻车，pattern 经过实战检验
- 纯 TS 实现，~30 行代码全部在 `updater.ts` 一个文件里
- 不需要任何新运行时、新二进制产物

### 决策 2：`.old` 文件清理放在启动入口

**选择**：`src/index.tsx` 在 `args.includes('--version')` 之前插入：

```typescript
try {
  const stale = process.execPath + '.old'
  if (existsSync(stale)) unlinkSync(stale)
} catch { /* silent */ }
```

失败静默——老进程刚结束、文件锁还没释放都可能导致 unlink 失败，没关系，下次启动再试。

**替代方案**：
- Windows `PendingFileRenameOperations` 注册表：需要重启才生效 + 需要 admin 权限
- 退出时清理自己：`--update` 跑到最后会自己退出，此时新版还没启动，还是老进程拿着锁，依然删不掉
- 每次调 `--update` 时清理：漏掉"单次升级 + 几天后再启动"的情况

**理由**：
- 启动时清理最可靠，哪怕用户隔了几天再用
- 几乎零开销（一个 `existsSync` + 一个 `unlink`）
- 失败无副作用

### 决策 3：第一版不做 auto-relaunch

**选择**：升级成功后 print `✓ Updated to X.Y.Z — please run \`soulkiller\` again to start the new version.` 直接退出。

**替代方案**：
- `spawn(newExe, { detached: true, stdio: 'ignore' }).unref()` + exit：UX 更丝滑
- 但：Windows detached spawn 会在某些终端（powershell、vscode integrated terminal）弹新窗口；且第一版我们并没好方法把当前命令行参数透明传给新版（用户可能跑的是 `soulkiller --update` 本身，relaunch `soulkiller` 会进 REPL 反而是两种不同行为）

**理由**：
- 简单、无意外行为、错误面少
- 如果用户真的有需求，下一个 change 再加

### 决策 4：Checksum 在替换前验证

**选择**：现有 `fetchChecksums()` 已经拉回了 remote hash；下载完 archive 后、调用 `Expand-Archive` / `tar -xzf` **之前**，对 archive 字节做 sha256 比对。不匹配则：删除 tmp 文件、print 错误、exit 1，**不进入替换阶段**。

**替代方案**：
- 只验证解压后的 binary 本身：档案里还有 `viewer/` 等文件，单只对 binary 做 hash 不能防被篡改的 zip 内部；对整个 archive 做更简单
- 不验证：当前现状，有被中间人替换的风险

**理由**：
- hash 在 proposal 阶段就在 R2 / GitHub 上发布，可信
- 一行代码增量：`Bun.CryptoHasher` 已被 import 使用
- 放在替换前，失败完全不影响现有 binary

### 决策 5：symlinked install path 规范化

**选择**：`realpath(execPath)` 在任何文件操作之前做一次，后续所有 rename / write 都用规范化后的路径。

**实现**：
```typescript
let targetPath: string
try {
  targetPath = realpathSync(execPath)
} catch {
  targetPath = execPath  // realpath 失败回退原路径
}
```

**理由**：
- Bun issue #15279 是个实实在在的用户场景（把 AppData 映射到 D 盘）
- `realpath` 在 Windows 上行为良好（会解 junction / symlink）
- 跨卷 rename 失败是 POSIX / Windows 共通坑，规范化后两端都能原子 rename

### 决策 6：多进程冲突 → 明确错误信息而不是静默失败

**选择**：rename-self 步骤若失败（`rename(exe, exe + '.old')` 抛错），立刻 stderr 打印：

```
  Failed: another soulkiller process may be holding the executable lock.
  Close any open REPL sessions and retry `soulkiller --update`.
```

然后 `process.exitCode = 1` 返回。

**替代方案**：
- 用 `tasklist` 枚举进程并主动提示谁还在跑：复杂，输出不稳定，不跨平台
- 重试循环：并发进程不会在几秒内关，等也白等

**理由**：
- Windows `rename` 失败在"自己被锁 / 另一个进程锁了自己"两种情况下信号相同，不做区分反正用户只要关掉就好
- 明确告诉用户怎么做一条命令就解决，比技术细节有用

## Risks / Trade-offs

| Risk | Mitigation |
|---|---|
| rename 成功但 write 新文件失败 → 用户机器上只剩 `.old` | 写入失败时 rename 回来（`rename(exe + '.old', exe)`），回滚到已知可用状态 |
| `.old` 清理钩子自己挂了（如文件仍被锁）阻塞启动 | try/catch 吞掉所有错误，启动流程不受影响；下次启动再尝试 |
| checksum 校验阶段新增 fetch（其实不新增，用现有 `fetchChecksums()` 结果）但如果远端 checksums.txt 暂时缺失会阻断升级 | 现有代码已经有 fallback："无 checksums 时只比版本号"。保留该行为，checksum 不可得时跳过 hash 校验并 warn，不阻断 |
| symlinked 路径 + Windows 权限问题：普通用户对 AppData 有写权限但没权限读目标卷 | `realpathSync` 在无权限时会抛，已有 try/catch 回退到原路径；如果原路径也不可写会在 rename 阶段抛出清晰错误 |
| 用户在升级过程中 Ctrl+C | rename 如果已完成但 write 未完成：留下 `.old` 且原路径为空或文件不全。下次启动没可执行文件，用户必须重装。**缓解**：把 rename 和 write 夹在一个 try 块内，catch 阶段执行回滚（rename `.old` 回来）|

## Migration Plan

1. 合入 v0.3.8（补丁版本）
2. macOS / Linux 用户：走 rename 分支，行为完全不变
3. Windows 用户：
   - 已装 ≤ v0.3.7：本次 `soulkiller --update` 仍会失败（他们装的是坏版本）。**但**下载 install.ps1 重新装一次 v0.3.8 后，后续所有升级会用新逻辑
   - 新装用户：第一次升级起就享受新逻辑
4. 在 GitHub Release notes 里专门写一段 "Windows users: if `--update` previously failed on your machine, please reinstall via `irm ... | iex` once. After that, future updates will work."

**Rollback**：如 rename-self 模式在实际用户机上出现未预期问题，revert 到既有逻辑 = 恢复为"Windows 不支持自升级"的现状。不会比现在更糟。

## Open Questions

- 需不需要在 `src/infra/i18n/` 补一套"升级失败 / 请关闭其他进程"的多语言消息？当前 updater 的输出全部硬编码英文。本次保持硬编码，和现有风格一致；未来做统一 i18n 时一起处理。
- 要不要保留 `.old` 文件允许用户手动回滚？不要——Windows 文件历史会自动保留快照；保留 `.old` 反而让目录看起来杂乱。默认清理。
