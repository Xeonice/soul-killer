## Why

安装脚本（`install.sh` / `install.ps1`）将二进制放入 `~/.soulkiller/bin/` 并写入 rc 文件配置 PATH，但当前 shell 进程不会自动重新加载 rc 文件。用户安装完后输入 `soulkiller` 会得到 `command not found`，必须手动打开新终端才能使用。这是一个常见的首次使用体验痛点。

## What Changes

- **install.sh**: 当 PATH 刚写入 rc 文件时，在安装结束消息中输出一条可直接复制粘贴的 `export PATH=...` 命令，并按 shell 类型（bash/zsh vs fish）输出对应语法
- **install.ps1**: 当 PATH 刚写入注册表时，输出 PowerShell 的 `$env:Path` 刷新命令，让用户在当前会话中立即可用

## Capabilities

### New Capabilities

（无新增能力）

### Modified Capabilities

- `install-script`: 安装完成后的输出消息增加「当前 shell 立即可用」的提示命令，覆盖 macOS/Linux（bash/zsh/fish）和 Windows（PowerShell）

## Impact

- 文件变更：`scripts/install.sh`、`scripts/install.ps1`
- 无 API 变更、无依赖变更
- 向后兼容：仅改变安装后的终端输出文案
