## MODIFIED Requirements

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
