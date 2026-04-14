## MODIFIED Requirements

### Requirement: Windows PowerShell 安装脚本

`scripts/install.ps1` SHALL 下载 Windows 二进制到 `$env:LOCALAPPDATA\soulkiller\`，并将其加入用户 PATH。Viewer 静态资源（archive 中的 `viewer/` 子目录）SHALL 安装到 `$env:USERPROFILE\.soulkiller\viewer`，与 runtime `viewer-server.ts` 硬编码读取路径 `join(homedir(), '.soulkiller', 'viewer')` 对齐；installer SHALL 在写入前确保父目录 `$env:USERPROFILE\.soulkiller\` 已存在。

#### Scenario: Windows 安装

- **WHEN** 在 Windows PowerShell 中执行 `irm .../install.ps1 | iex`
- **THEN** SHALL 下载 `soulkiller-windows-x64.zip`，解压到本地目录，并添加到用户 PATH
- **AND** 二进制 SHALL 装到 `$env:LOCALAPPDATA\soulkiller\soulkiller.exe`

#### Scenario: Windows viewer 安装到 runtime 约定路径

- **WHEN** archive 中包含 `viewer/` 子目录
- **THEN** SHALL 把 viewer 移动到 `$env:USERPROFILE\.soulkiller\viewer`
- **AND** SHALL NOT 把 viewer 放到 `$env:LOCALAPPDATA\soulkiller\viewer`
- **AND** 若 `$env:USERPROFILE\.soulkiller\` 不存在 SHALL 先 `New-Item -ItemType Directory -Force` 建出

#### Scenario: Windows 旧位置残留不阻塞安装

- **WHEN** `$env:LOCALAPPDATA\soulkiller\viewer` 存在（来自旧版 installer）
- **THEN** 新 installer SHALL NOT 主动清理该目录
- **AND** SHALL 正常把新 viewer 写到 `$env:USERPROFILE\.soulkiller\viewer`
- **AND** runtime SHALL 从后者读取，忽略旧残留
