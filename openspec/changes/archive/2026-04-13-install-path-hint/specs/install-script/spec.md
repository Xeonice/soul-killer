## MODIFIED Requirements

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
