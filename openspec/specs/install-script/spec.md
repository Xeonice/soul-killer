## ADDED Requirements

### Requirement: Unix 安装脚本自动检测平台并安装

`scripts/install.sh` SHALL 检测 OS 和 Arch，下载对应二进制到 `~/.soulkiller/bin/`。

#### Scenario: macOS ARM 安装

- **WHEN** 在 macOS ARM64 上执行 `curl -fsSL .../install.sh | sh`
- **THEN** SHALL 下载 `soulkiller-darwin-arm64.tar.gz`，解压到 `~/.soulkiller/bin/soulkiller`，文件具有可执行权限

#### Scenario: Linux x64 安装

- **WHEN** 在 Linux x86_64 上执行安装脚本
- **THEN** SHALL 下载 `soulkiller-linux-x64.tar.gz` 并安装到 `~/.soulkiller/bin/soulkiller`

### Requirement: PATH 自动配置

安装脚本 SHALL 检测 `~/.soulkiller/bin` 是否在 PATH 中，若不在则写入 shell 配置文件。

#### Scenario: zsh 用户 PATH 注入

- **WHEN** 用户使用 zsh 且 PATH 不含 `~/.soulkiller/bin`
- **THEN** SHALL 追加 `export PATH="$HOME/.soulkiller/bin:$PATH"` 到 `~/.zshrc`

#### Scenario: PATH 已存在时不重复写入

- **WHEN** `~/.soulkiller/bin` 已在 PATH 中
- **THEN** SHALL 跳过 PATH 写入，不产生重复条目

### Requirement: macOS quarantine 清除

安装脚本 SHALL 在 macOS 上执行 `xattr -d com.apple.quarantine` 清除 Gatekeeper 隔离属性。

#### Scenario: macOS 二进制可直接运行

- **WHEN** 在 macOS 上完成安装
- **THEN** 执行 `soulkiller` SHALL 不触发 Gatekeeper 拦截弹窗

### Requirement: Windows PowerShell 安装脚本

`scripts/install.ps1` SHALL 下载 Windows 二进制到 `$env:LOCALAPPDATA\soulkiller\`，并将其加入用户 PATH。

#### Scenario: Windows 安装

- **WHEN** 在 Windows PowerShell 中执行 `irm .../install.ps1 | iex`
- **THEN** SHALL 下载 `soulkiller-windows-x64.zip`，解压到本地目录，并添加到用户 PATH

### Requirement: 安装结果提示

安装完成后 SHALL 打印清晰的成功信息，包含：soulkiller 版本、安装路径。当 PATH 是首次配置时，SHALL 额外输出一条可直接复制粘贴执行的命令，让用户在当前 shell 中立即使用 `soulkiller`，命令语法 SHALL 匹配用户当前的 shell 类型。

#### Scenario: Unix bash/zsh 首次安装后输出 export 命令

- **WHEN** 在 bash 或 zsh 环境下首次安装（PATH 刚写入 rc 文件）
- **THEN** SHALL 输出 `export PATH="$HOME/.soulkiller/bin:$PATH"` 供用户复制执行，并同时提示"或打开新终端窗口"

#### Scenario: Unix fish 首次安装后输出 set 命令

- **WHEN** 在 fish 环境下首次安装（PATH 刚写入 config.fish）
- **THEN** SHALL 输出 `set -gx PATH $HOME/.soulkiller/bin $PATH` 供用户复制执行，并同时提示"或打开新终端窗口"

#### Scenario: Windows PowerShell 首次安装后输出 env 刷新命令

- **WHEN** 在 Windows PowerShell 下首次安装（PATH 刚写入注册表）
- **THEN** SHALL 输出 `$env:Path = "$env:LOCALAPPDATA\soulkiller;$env:Path"` 供用户复制执行，并同时提示"或打开新终端窗口"

#### Scenario: PATH 已存在时不输出额外命令

- **WHEN** `~/.soulkiller/bin`（或 Windows 对应目录）已在 PATH 中
- **THEN** SHALL 仅输出 `Run: soulkiller` 提示，不输出 PATH 刷新命令

#### Scenario: 成功安装输出

- **WHEN** 安装成功完成
- **THEN** SHALL 打印 soulkiller 版本、安装路径
