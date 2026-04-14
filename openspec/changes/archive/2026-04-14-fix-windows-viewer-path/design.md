## Context

Windows 自更新流程的两个独立 bug 在同一次首次升级中连锁暴露：

1. `src/cli/updater.ts:431-433` 直接 `renameSync(extractedViewer, ~/.soulkiller/viewer)`。Unix 侧 `install.sh` 会预建 `~/.soulkiller/bin/`，因此父目录 `~/.soulkiller/` 一定存在；Windows 侧 `install.ps1` 只建 `%LOCALAPPDATA%\soulkiller`，从不 touch `%USERPROFILE%\.soulkiller`，所以首次 `--update` 命中 `ENOENT`。
2. `install.ps1:49-53` 把 viewer 装到 `%LOCALAPPDATA%\soulkiller\viewer`，但 runtime `src/export/state/viewer-server.ts:23` 写死 `join(homedir(), '.soulkiller', 'viewer')`。installer 装的 viewer 对主程序完全不可见——`soulkiller runtime viewer tree <id>` 会报 `index.html not found`。

两个 bug 的"正确位置"由 runtime 那行硬编码定义（canonical source）。updater 写的位置本身是对的，只是没建父目录；installer 写的位置是错的。

## Goals / Non-Goals

**Goals:**
- Windows 首次安装后 `soulkiller --update` 不因 `~/.soulkiller/` 缺失而崩
- Windows installer 把 viewer 装到 runtime 实际读取的位置
- Unix 路径行为 100% 保持不变（install.sh + updater Unix 分支都不动）

**Non-Goals:**
- 不重构 viewer 根目录策略（例如改成相对 exec 路径）—— runtime 硬编码 `homedir() + /.soulkiller/viewer` 保留不动
- 不清理已经错装到 `%LOCALAPPDATA%\soulkiller\viewer` 的残留文件 —— 占磁盘极小，且清理逻辑会让 install.ps1 变复杂；留给用户手动删或下次重装覆盖
- 不迁移二进制位置 —— `%LOCALAPPDATA%\soulkiller\soulkiller.exe` 保留，Windows PATH 布局稳定

## Decisions

### Decision 1: updater 用 `mkdirSync(recursive)` 自愈父目录

在 `renameSync` 前插入 `mkdirSync(dirname(viewerDst), { recursive: true })`。

**Why**: `recursive: true` 对已存在目录是 no-op，零副作用；一行防御覆盖所有"父目录缺失"场景（不仅 Windows 首装，也涵盖 Unix 用户手动清理过 `~/.soulkiller/` 的边缘情况）。

**Alternative considered**: 放在 updater 入口一次性建好所有可能需要的目录。反对 —— 违反"就近防御"原则，未来新增写入路径时容易漏掉。

### Decision 2: install.ps1 viewer 目标改为 `$env:USERPROFILE\.soulkiller\viewer`

与 runtime 硬编码对齐，而非反向修改 runtime。

**Why**: runtime 路径规则（`homedir()/.soulkiller/...`）是 soul 数据、config、viewer 等多个子系统的共享约定，改 runtime 影响面远大于改 installer。Installer 只是部署辅助，迁就 runtime 才是最低成本对齐。

**Alternative considered**: 把 runtime `VIEWER_DIR` 改成相对 `process.execPath`。反对 —— 会破坏 Unix 侧已存档的设计（install.sh 也把 viewer 放在 `~/.soulkiller/viewer`，与二进制 `~/.soulkiller/bin/soulkiller` 不同目录）；会让开发模式（`bun run dev`，execPath 是 bun）行为错乱。

### Decision 3: 不清理旧位置

Installer 不主动删 `$InstallDir\viewer`（旧位置）。

**Why**: 残留只占几 MB 磁盘，无功能影响；主动清理需要额外 existence check + 错误处理，且若用户手动改了那个目录会误删。交给下一次 reinstall 自然覆盖或用户手动处理。

## Risks / Trade-offs

- **Risk**: 已经错装并依赖 `%LOCALAPPDATA%\soulkiller\viewer` 的非官方脚本或工具链可能受影响 → 可接受，这是修 bug 的必要代价，且该路径从未在文档中承诺
- **Risk**: `mkdirSync(recursive)` 抛 EPERM（极端权限场景）会让 update 失败 → 与原先 `renameSync` 同样的失败面；无新增风险
- **Trade-off**: 保留旧位置残留，磁盘上可能同时存在两份 viewer → 低危，优先简化 installer 逻辑

## Migration Plan

1. 合并 PR、发 v0.3.9
2. Windows 存量用户运行新版 `--update`：updater 把新 viewer 写到 `~/.soulkiller/viewer`（与旧 `%LOCALAPPDATA%\soulkiller\viewer` 并存，runtime 只会读前者）
3. 完全重装的用户：新 `install.ps1` 直接装到正确位置，无残留

无需 rollback 分步骤 —— 两处改动都是 backward-compatible（updater 只增加一个 mkdir；install.ps1 换目标目录不影响二进制运行）。

## Open Questions

无。
