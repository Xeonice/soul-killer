## 1. install.sh 改造

- [x] 1.1 将 `configure_path()` 中检测到的 `SHELL_NAME` 和 `RC_FILE` 提升为脚本级变量，供 `main()` 使用
- [x] 1.2 在 `main()` 的 `PATH_CONFIGURED=1` 分支中，根据 `SHELL_NAME` 输出对应的 PATH 刷新命令（bash/zsh: `export PATH=...`；fish: `set -gx PATH ...`），并保留"或打开新终端窗口"的备选提示
- [x] 1.3 在 `PATH_CONFIGURED=0` 分支中保持现有行为（仅输出 `Run: soulkiller`）

## 2. install.ps1 改造

- [x] 2.1 在 `$PathConfigured` 分支中输出 `$env:Path = "$env:LOCALAPPDATA\soulkiller;$env:Path"` 刷新命令，并保留"或打开新终端窗口"的备选提示
