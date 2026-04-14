## 1. updater.ts — 抽出 `atomicReplaceBinary` 原语（决策 0）

- [x] 1.1 定义 `ReplaceResult` / `ReplaceFailure` typed union（`LOCKED` / `PERMISSION` / `DISK_FULL` / `UNKNOWN`）
- [x] 1.2 抽出 `resolveTargetPath(execPath: string): string`：尝试 `realpathSync`，失败回退 `execPath`
- [x] 1.3 实现 `atomicReplaceBinary(src, dst)`：先 `resolveTargetPath(dst)` 规范化；按平台派发到 Unix 或 Windows 分支；所有错误映射到 typed `ReplaceFailure`
- [x] 1.4 Unix 分支：`rename(src, dst)` 为主路径；`EXDEV` 时 fallback 到 `writeFileSync(dst, read(src))` + `chmod 0o755`（保留现有 fallback 能力，但错误分类改为 typed）
- [x] 1.5 Windows 分支：`rename(dst, dst+'.old')` → `writeFileSync(dst, read(src))`；write 失败时执行 rollback `rename(dst+'.old', dst)`
- [x] 1.6 改写 `runUpdate` 替换调用点：**一行** `await atomicReplaceBinary(...)`，原有 `try { rename } catch { read+write }` 代码块整块删除
- [x] 1.7 实现 `reportReplaceFailure(reason)`：按 `code` 分流用户文案（LOCKED → "关闭其他 REPL"，PERMISSION → "运行权限不足"，DISK_FULL → "磁盘已满"，UNKNOWN → 原始 cause message）

## 2. Archive checksum 预校验

- [x] 2.1 在下载完成、进入 extract 之前，用 `Bun.CryptoHasher('sha256')` 对 archive buffer 计算 hash
- [x] 2.2 从现有 `fetchChecksums()` 结果里取 `soulkiller-<platform>.<ext>` 对应 hash（注意 key 不是 binary 名而是 archive 名）
- [x] 2.3 hash 不匹配时：清理 tmp archive、输出前 16 字符的两端 hash 对比、`exitCode = 1`、return
- [x] 2.4 `fetchChecksums()` 返回 null 或缺失当前 archive 条目时：打印 warn 但继续（保留现有 fallback 行为）

## 3. 入口前置 `.old` 清理

- [x] 3.1 `src/index.tsx` 在现有 `args = process.argv.slice(2)` 后、任何命令派发之前，插入一个小函数 `cleanupStaleOld()`
- [x] 3.2 函数内部：`try { unlinkSync(process.execPath + '.old') } catch { /* silent */ }`；同时规范化一次路径避免 symlink 漏删
- [x] 3.3 `doctor` / `runtime` / `skill` / `--version` / `--update` 等分支前调用一次即可，派发后也行（顺序无关）

## 4. 错误信息与 UX

- [x] 4.1 Windows rename 失败：输出 "another soulkiller process may be holding the executable lock. Close any open REPL sessions and retry `soulkiller --update`."
- [x] 4.2 升级成功信息改为 "✓ Updated to X.Y.Z — please run `soulkiller` again to start the new version."（Windows 分支必须提示手动 relaunch；Unix 不强制但统一文案亦可）
- [x] 4.3 rollback 成功时输出 "⚠ Write failed. Reverted to previous version."
- [x] 4.4 rollback 失败时（极端情况）输出 "✗ CRITICAL: Write failed and revert also failed. Manual reinstall required."

## 5. 测试

- [x] 5.1 新增 `tests/unit/cli/updater.test.ts`：
  - `resolveTargetPath`: symlink 路径解析；realpath 失败时 fallback
  - `atomicReplaceBinary` Unix 正常路径：`rename` 成功，返回 `{ ok: true }`
  - `atomicReplaceBinary` Unix EXDEV：mock rename 抛 EXDEV，期望落入 writeFileSync fallback
  - `atomicReplaceBinary` Windows 正常：mock 平台为 win32，rename + writeFileSync 均成功
  - `atomicReplaceBinary` Windows rename 失败：返回 `LOCKED` reason，原文件不动
  - `atomicReplaceBinary` Windows write 失败：触发 rollback，`.old` 被 rename 回原位，返回 `DISK_FULL` 或 `UNKNOWN`
  - `atomicReplaceBinary` 权限失败：返回 `PERMISSION`
  - checksum 预校验：match 通过；不 match 抛错 + tmp 清理
  - checksum fallback：null 返回继续流程
  - `reportReplaceFailure`: 四种 code 对应四种预期文案
- [x] 5.2 `cleanupStaleOld` 测试：`.old` 存在时清理；不存在时 no-op；unlink 失败时静默
- [x] 5.3 `bun run build` 零 TS 错误
- [x] 5.4 `bun run test` 全部通过

## 6. 文档

- [x] 6.1 `CLAUDE.md` 若涉及"Release & Distribution"章节描述升级流程，补一句 Windows 会产生临时 `.old`
- [ ] 6.2 Release notes 预留提示（本次合入时可写）："Windows 用户升级 v0.3.7 → v0.3.8 仍会失败，请重跑 install.ps1 一次；v0.3.8 起所有后续升级正常"

## 7. 验证

- [x] 7.1 本地 macOS 上跑 `soulkiller --update`（从旧 release 到 latest）确认 Unix 分支完全未受影响
- [x] 7.2 本地构造 Windows fixture：手动在 tmp 目录模拟 `<exe>` + `<exe>.old`，跑单测覆盖每种分支
- [ ] 7.3 （可选，需 Windows 环境）在实际 Windows 机器上跑完整升级流程，对比 Deno 的行为
- [x] 7.4 Checksum 手动翻转一位，确认升级中止且 `<exe>` 不变
