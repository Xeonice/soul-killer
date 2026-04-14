## ADDED Requirements

### Requirement: --version flag 输出版本号

`soulkiller --version` SHALL 在 ink 渲染前输出版本号并退出。

#### Scenario: 查看版本

- **WHEN** 执行 `soulkiller --version`
- **THEN** SHALL 输出 `soulkiller 0.2.0`（版本号来自构建时注入）并以 exit code 0 退出

### Requirement: --update flag 触发自我更新

`soulkiller --update` SHALL 查询 GitHub Release 最新版本，若有新版本则下载替换当前二进制。

#### Scenario: 有新版本可用

- **WHEN** 当前版本 `0.1.0`，GitHub 最新 Release 为 `v0.2.0`
- **THEN** SHALL 下载对应平台的新二进制，替换 `process.execPath`，打印更新成功信息

#### Scenario: 已是最新版本

- **WHEN** 当前版本与 GitHub 最新 Release 一致
- **THEN** SHALL 打印"已是最新版本"并退出

#### Scenario: 网络失败

- **WHEN** 无法连接 GitHub API
- **THEN** SHALL 打印明确的网络错误信息并以非零 exit code 退出

### Requirement: 原子替换二进制

更新过程 SHALL 先下载到临时文件，验证完整后（archive sha256 校验通过）再根据平台执行替换，确保失败不损坏当前二进制。

#### Scenario: 下载中断不影响当前版本

- **WHEN** 下载新版本过程中网络中断
- **THEN** 当前二进制 SHALL 保持不变，可继续正常使用

#### Scenario: checksum 校验失败不影响当前版本

- **WHEN** 下载完成后 checksum 校验失败
- **THEN** 当前二进制 SHALL 保持不变
- **AND** 临时 archive 文件 SHALL 被清理

#### Scenario: macOS / Linux 替换路径

- **WHEN** `atomicReplaceBinary` 在 Unix 平台上被调用
- **THEN** SHALL 优先尝试 `renameSync(src, dst)` 原子覆盖
- **AND** 遇到 `EXDEV`（跨设备）错误时 SHALL 回退到 `writeFileSync(dst, read(src))`
- **AND** SHALL 保持 POSIX 权限位 `0o755`

#### Scenario: Windows 替换路径

- **WHEN** `atomicReplaceBinary` 在 Windows 上被调用
- **THEN** SHALL 走 Windows rename-self 策略（见下方 Requirement）
- **AND** SHALL NOT 直接 rename 或 writeFileSync 覆盖运行中的 exe

#### Scenario: 调用方只看到统一接口

- **WHEN** `runUpdate` 调用 `atomicReplaceBinary(src, dst)`
- **THEN** 调用方 SHALL 以相同的 API 处理 Unix / Windows 两条路径的结果
- **AND** SHALL NOT 观察到平台特定字段或异常类型

### Requirement: 统一的 atomicReplaceBinary 原语

`updater.ts` SHALL 将"把一个临时文件原子替换到目标可执行路径"的逻辑抽出为独立函数 `atomicReplaceBinary(src, dst)`，所有平台差异收敛在该函数内部。`runUpdate` 主流程 SHALL NOT 出现 `isWindows` / `process.platform` 分支。

#### Scenario: 成功替换返回 typed result

- **WHEN** `atomicReplaceBinary(src, dst)` 成功完成
- **THEN** SHALL 返回 `{ ok: true }`
- **AND** 调用方 SHALL 能直接通过 `result.ok` 判定结果，无需 try/catch

#### Scenario: 失败返回分类错误

- **WHEN** 替换过程中发生错误
- **THEN** SHALL 返回 `{ ok: false, reason: { code, message, ... } }`
- **AND** `code` SHALL 是以下枚举之一：`LOCKED` / `PERMISSION` / `DISK_FULL` / `UNKNOWN`
- **AND** `message` SHALL 是面向用户的可读描述（含建议动作）

#### Scenario: 主流程不再出现平台 if/else

- **WHEN** 审视 `runUpdate` 的替换调用点
- **THEN** SHALL 只有一处 `await atomicReplaceBinary(...)` 调用
- **AND** 平台特定逻辑 SHALL 全部位于 `atomicReplaceBinary` 内部

### Requirement: Windows 平台 rename-self 替换策略

在 Windows 平台下，`soulkiller --update` SHALL 使用"rename running exe"策略替换二进制：先 rename 运行中的 exe 到 `<execPath>.old`，再将新二进制写入 `<execPath>`。运行中 exe 的文件锁是 Windows 特有约束，直接写入或删除会返回 `EBUSY` / `ERROR_SHARING_VIOLATION`。

#### Scenario: Windows 正常升级

- **WHEN** 在 Windows 上执行 `soulkiller --update`，且有新版本可用
- **THEN** SHALL 先将 `process.execPath` 规范化（解 symlink / junction）
- **AND** SHALL 先 rename `<execPath>` 到 `<execPath>.old`
- **AND** SHALL 将新二进制 `writeFileSync` 写入 `<execPath>`
- **AND** SHALL 输出 `✓ Updated to X.Y.Z — please run \`soulkiller\` again to start the new version.`
- **AND** exit code SHALL 为 0

#### Scenario: Windows rename 失败（其他进程持有锁）

- **WHEN** rename 步骤抛出错误（典型场景：用户另开了一个 REPL 会话持有 exe 锁）
- **THEN** SHALL 输出明确的错误信息，提示用户关闭其他 soulkiller 进程后重试
- **AND** `<execPath>` SHALL 保持不变（未被破坏）
- **AND** exit code SHALL 为非零

#### Scenario: Windows write 失败回滚

- **WHEN** rename 成功但 `writeFileSync(<execPath>, newBinary)` 抛错（典型场景：磁盘满、权限问题）
- **THEN** SHALL 尝试 rename `<execPath>.old` 回 `<execPath>` 完成回滚
- **AND** SHALL 输出错误信息并以非零 exit code 退出
- **AND** 回滚成功后用户 SHALL 能继续使用旧版本

### Requirement: 启动时清理 stale `.old` 文件

soulkiller 二进制启动时（在任何其他命令派发之前）SHALL 尝试删除 `<process.execPath>.old`。

#### Scenario: 存在 stale `.old`

- **WHEN** 用户上次升级成功、当前为新版本首次启动
- **AND** `<execPath>.old` 文件存在
- **THEN** SHALL 尝试 `unlinkSync(<execPath>.old)`

#### Scenario: `.old` 文件尚被锁（极罕见）

- **WHEN** unlink 失败（上一个老进程尚未完全退出，Windows 文件锁未释放）
- **THEN** SHALL 静默忽略错误，不影响正常启动流程
- **AND** 下次启动 SHALL 再次尝试清理

#### Scenario: 非 Windows 平台

- **WHEN** 在 macOS / Linux 上启动
- **THEN** `.old` 文件通常不存在（Unix rename 直接覆盖），但清理钩子 SHALL 仍然运行且无错误

### Requirement: Symlinked 安装路径规范化

任何替换 / 重命名操作之前，SHALL 使用 `fs.realpathSync` 将 `process.execPath` 规范化为物理路径，避免因符号链接 / junction 导致跨卷 rename 失败。

#### Scenario: execPath 是 symlink / junction

- **WHEN** 用户通过 `mklink` 或 `ln -s` 把 `~/.soulkiller/bin/soulkiller` 映射到其他位置
- **THEN** 所有 rename / write 操作 SHALL 使用规范化后的目标路径

#### Scenario: realpath 失败

- **WHEN** `realpathSync` 抛错（权限或路径不可访问）
- **THEN** SHALL 回退到原始 `process.execPath` 作为目标
- **AND** SHALL NOT 中断升级流程

### Requirement: 下载 archive 的 checksum 预校验

升级流程 SHALL 在解压 archive 和替换二进制 **之前**，对下载的 archive 字节做 sha256 校验。校验失败时 SHALL abort 整个升级。

#### Scenario: checksum 可获取且匹配

- **WHEN** `fetchChecksums()` 成功返回 remote hash map
- **AND** 本地下载的 archive sha256 与 map 中对应 `soulkiller-<platform>.<ext>` 的 hash 一致
- **THEN** SHALL 继续解压和替换流程

#### Scenario: checksum 不匹配

- **WHEN** 本地 archive hash 与 remote hash 不一致
- **THEN** SHALL 删除已下载的临时 archive
- **AND** SHALL 输出明确的错误信息（包含两个 hash 前 16 字符）
- **AND** SHALL NOT 进入解压 / 替换阶段
- **AND** exit code SHALL 为非零
- **AND** `<execPath>` SHALL 保持不变

#### Scenario: checksum 不可获取（远端缺失 / 网络问题）

- **WHEN** `fetchChecksums()` 返回 `null` 或不含当前平台条目
- **THEN** SHALL 输出一条 warning 但继续升级（保留现有 fallback 行为）
- **AND** 不阻断升级流程

### Requirement: Viewer 静态资源更新前自愈父目录

`runUpdate` 在 `renameSync` 替换 `~/.soulkiller/viewer` 之前 SHALL 调用 `mkdirSync(dirname(viewerDst), { recursive: true })` 确保父目录存在。Windows 首次安装后 `~/.soulkiller/` 可能从未被创建，直接 rename 会抛 `ENOENT` 导致升级中断。

#### Scenario: Windows 首次安装后升级

- **WHEN** Windows 用户刚通过 `install.ps1` 安装，`%USERPROFILE%\.soulkiller\` 目录不存在
- **AND** 用户执行 `soulkiller --update` 且下载的 archive 包含 `viewer/` 子目录
- **THEN** SHALL 先建出 `%USERPROFILE%\.soulkiller\` 父目录
- **AND** SHALL 成功将新 viewer 重命名到 `%USERPROFILE%\.soulkiller\viewer`
- **AND** SHALL 输出 `✓ Viewer files updated`
- **AND** 升级流程 SHALL 以 exit code 0 完成

#### Scenario: 父目录已存在

- **WHEN** `~/.soulkiller/` 已存在（典型 Unix 场景或已升级过的 Windows）
- **THEN** `mkdirSync(recursive: true)` SHALL 为 no-op
- **AND** 后续 rename SHALL 按原逻辑执行

#### Scenario: Archive 不含 viewer

- **WHEN** 下载的 archive 中 `viewer/` 不存在
- **THEN** SHALL 跳过 viewer 替换分支（含 mkdirSync 调用）
- **AND** SHALL NOT 误建空的 `~/.soulkiller/` 目录

### Requirement: release archive 解压实现
`soulkiller --update` / `/upgrade` 下载 release archive 后的解压 SHALL 使用纯 TypeScript 实现：`.zip`（Windows release）走 `fflate.unzipSync`，`.tar.gz`（Unix release）走 `fflate.gunzipSync` + `nanotar.parseTar`。不得调用 `powershell Expand-Archive` 或 `tar -xzf` 等外部可执行文件。

#### Scenario: Windows release 解压
- **WHEN** 在 Windows 上执行 `soulkiller --update` 下载到 `soulkiller-windows-x64.zip`
- **THEN** 通过 `fflate.unzipSync` 解包，不 spawn `powershell.exe` 或任何子进程

#### Scenario: Unix release 解压
- **WHEN** 在 Linux 或 macOS 上执行 `soulkiller --update` 下载到 `.tar.gz`
- **THEN** 通过 fflate+nanotar 纯 JS 路径解包

#### Scenario: 行为保持不变
- **WHEN** 解压成功后执行后续的 sha256 校验、原子替换、Windows rename-self
- **THEN** 所有既有逻辑（checksums.txt 下载、锁定错误处理、cleanupStaleOld）保持不变，仅替换解压这一子步骤

### Requirement: runUpdate 支持 silent/onProgress 选项
`runUpdate()` SHALL 接受可选参数 `{ silent?: boolean; onProgress?: (event: UpdateProgress) => void }`。`silent: true` 时 MUST NOT 直接写 stdout（`console.log/warn/error`），所有阶段转换 MUST 通过 `onProgress` 回调上报。CLI 直接调用（`soulkiller --update`）使用默认参数，原有 console 输出行为保持不变。

#### Scenario: CLI 调用默认参数不变
- **WHEN** 用户执行 `soulkiller --update`（命令行直接调用）
- **THEN** `runUpdate()` 以默认参数调用，现有 console.log 输出保持原样

#### Scenario: REPL 调用静默且发事件
- **WHEN** REPL 的 `/upgrade` 组件调用 `runUpdate({ silent: true, onProgress })`
- **THEN** 升级全程 stdout 无直接 console 输出；每个阶段（checking / downloading / extracting / replacing / complete / error）通过 `onProgress` 回调上报结构化事件

