## Why

`soulkiller --update` 在 Windows 上必然失败：

```
Failed to replace binary: EBUSY: resource busy or locked,
  open 'C:\Users\...\AppData\Local\soulkiller\soulkiller.exe'
```

`src/cli/updater.ts` 当前的替换逻辑是 `renameSync(new, exe)` + `writeFileSync(exe, data)` 纯 Unix 思维——POSIX 允许覆盖 / 删除运行中的可执行文件，Windows 不允许。结果 Windows 用户根本没有可用的自升级路径，必须重新下载安装脚本跑一次。

调研结论（详见 explore 会话）：生态内没有 drop-in 的 npm/bun 自更新库；Electron 生态的 `electron-updater` 仅适用于 Electron 打包，Rust 的 `self_update` crate 要引入新工具链。**Deno 的 `deno upgrade` 源码使用"重命名运行中的 exe"这一 Windows 怪癖**（运行中的 exe 不能写 / 不能删，但**可以 rename**），是生产验证过的模式。我们把同一模式移植到 TS 即可，~30 行代码，无新依赖。

## What Changes

### 统一替换原语（核心重构）

当前 `updater.ts:223-237` 有两条替换路径——`renameSync` 正常路径 + `Bun.file.arrayBuffer + writeFileSync` 的 catch-fallback，后者是历史上为处理 Unix 跨盘 `EXDEV` 加的。加 Windows 支持时不应该叠第三条分支，而是抽一个统一的 `atomicReplaceBinary(src, dst)` 原语：

- 所有替换都走这一个入口，内部按平台派发
- Unix 分支：`rename`，捕获 `EXDEV` 时回退到"read + write"（保留现有能力）
- Windows 分支：`rename(dst, dst+'.old')` → `writeFileSync(dst, data)`（rename-self 模式）
- 统一的 rollback 语义：任何一步失败都能回到"原 dst 可用"状态
- 统一的错误分类：`EBUSY` / `EACCES` / `EXDEV` / `ENOSPC` 分别给出人类可读的提示

### 其他 scope

- **BREAKING** Windows 升级不再失败（见上方原语 Windows 分支）
- 新增"启动时清理 stale `.old` 文件"钩子：`src/index.tsx` 加 ~3 行，每次冷启尝试 `unlink(execPath + '.old')`，失败静默
- 修复 Bun 两个已知 Windows 坑：
  - **symlinked install path**：所有文件操作前先 `fs.realpathSync(execPath)` 规范化，防止 Bun issue #15279
  - **多进程并发**：rename 失败时给出"关闭其他 REPL"的明确指引（不需要 tasklist 这类额外 API）
- 补上 checksum 验证：`fetchChecksums()` 拿到 remote hash 后，下载完 archive 应立即校验字节一致性；hash 不匹配时 abort，不让坏包进到 extract / replace 阶段
- 消除 try/catch fallback 的语义模糊：当前 catch 吞掉一切错误然后用 writeFileSync 再试一遍，用户看不到真实原因。新原语在每一步失败时打印 *为什么* 失败以及怎么解决

## Capabilities

### Modified Capabilities
- `self-update`: 新增 Windows 替换语义 + checksum 预校验 + `.old` 清理约定

## Impact

- `src/cli/updater.ts` — 整体重构：
  - 抽出 `atomicReplaceBinary(src, dst)` 统一原语
  - 替换原有两条路径（`renameSync` + catch-fallback `writeFileSync`）
  - 补 checksum 预校验
  - 补 `realpathSync` 路径规范化
  - 平台分支只出现在 `atomicReplaceBinary` 内部，`runUpdate` 主流程无平台 if/else
- `src/index.tsx` — 入口前置添加 `.old` 清理钩子
- `tests/unit/cli/updater.test.ts` — 新增，覆盖 `atomicReplaceBinary` 的 Unix 正常 / Unix EXDEV fallback / Windows 正常 / Windows rename 失败 / Windows write 失败回滚 / symlinked path 规范化，以及 checksum 不匹配 abort、`.old` 清理
- `CLAUDE.md` — "Release & Distribution" 章节补一句：Windows 升级使用 rename-self 模式，会短暂产生 `<exe>.old` 并在下次启动时自动清理
- 无新运行时依赖；无 CI 改动；无 Worker 路由改动
- 不影响：macOS / Linux 升级语义（仍然 `rename` 优先、`EXDEV` 时回退 read+write）
- 老版本 v0.3.7 前的 Windows 用户仍需重装一次 install.ps1（当前坏版本没法自升级），之后所有后续升级享受新逻辑
