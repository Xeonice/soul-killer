## Why

Windows 用户在首次安装后运行 `soulkiller --update` 会因 `~/.soulkiller/` 父目录不存在而触发 `ENOENT`（`install.ps1` 只建 `%LOCALAPPDATA%\soulkiller`）。即便 update 不报错，installer 也把 viewer 静态资源写到了 `%LOCALAPPDATA%\soulkiller\viewer`，而 runtime (`src/export/state/viewer-server.ts:23`) 硬编码从 `~/.soulkiller/viewer` 读取，路径错配导致已安装的 viewer 对主程序不可见，分支树可视化等功能失效。

## What Changes

- `src/cli/updater.ts`：viewer `renameSync` 之前调用 `mkdirSync(dirname(viewerDst), { recursive: true })`，自愈缺失的 `~/.soulkiller/` 父目录
- `scripts/install.ps1`：viewer 目标从 `$InstallDir\viewer`（即 `%LOCALAPPDATA%\soulkiller\viewer`）改为 `$env:USERPROFILE\.soulkiller\viewer`，与 runtime 期望对齐；必要时先建父目录
- 二进制仍装在 `%LOCALAPPDATA%\soulkiller\soulkiller.exe`（Windows PATH 布局不变），仅 viewer 迁址

## Capabilities

### New Capabilities
<!-- 无 -->

### Modified Capabilities
- `self-update`: Windows 自更新必须自建 `~/.soulkiller/` 父目录，viewer 替换不得假设父目录已存在
- `install-script`: Windows installer 必须将 viewer 装到 `~/.soulkiller/viewer`（runtime 约定位置），而非二进制相邻目录

## Impact

- 代码：`src/cli/updater.ts`、`scripts/install.ps1`
- 契约不变：CLI 命令面无改动，`soulkiller --update` 参数不变；Windows 二进制安装位置不变
- 测试：现有 `tests/unit/cli/updater.test.ts` 15 个用例均通过；需补一个父目录缺失场景的回归用例
- 用户影响：已经错装到 `%LOCALAPPDATA%\soulkiller\viewer` 的 Windows 用户，下次 `--update` 会把正确的 viewer 写到 `~/.soulkiller/viewer`；旧位置残留文件不会被自动清理（低危，不影响功能）
