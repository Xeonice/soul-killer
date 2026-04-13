## MODIFIED Requirements

### Requirement: 安装脚本解压 viewer 目录

install.sh 和 install.ps1 SHALL 解压归档后将 `viewer/` 目录安装到 `~/.soulkiller/viewer/`。

#### Scenario: Unix 安装

- **WHEN** 在 macOS/Linux 执行安装脚本
- **THEN** SHALL 将归档中的 `viewer/` 解压到 `~/.soulkiller/viewer/`，二进制解压到 `~/.soulkiller/bin/soulkiller`

#### Scenario: Windows 安装

- **WHEN** 在 Windows 执行安装脚本
- **THEN** SHALL 将 `viewer/` 解压到 `$env:LOCALAPPDATA\soulkiller\viewer\`
