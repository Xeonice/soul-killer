## Context

当前 `install.sh` 和 `install.ps1` 安装完毕后，如果是首次安装（PATH 刚写入 rc 文件），仅提示用户"打开新终端窗口"。但用户通常期望安装后立即可用——这是 CLI 工具安装体验的常见痛点。Rust (rustup)、Deno、Homebrew 等主流工具都会输出一条可复制的命令来刷新当前 shell 的 PATH。

## Goals / Non-Goals

**Goals:**
- 安装完成后，用户能看到一条可直接复制粘贴执行的命令，在当前 shell 中立即使用 `soulkiller`
- 覆盖三个平台的 shell 差异：bash/zsh、fish、PowerShell

**Non-Goals:**
- 不改变安装方式（不从 `curl | sh` 改为 `eval "$(curl ...)"`）
- 不自动 source rc 文件（在子 shell 中无效）
- 不改变 PATH 写入逻辑本身

## Decisions

### Decision 1: 输出可复制命令而非自动执行

**选择**: 打印 `export PATH=...` 命令让用户手动复制执行（方案 B）

**备选方案**:
- 方案 A: 脚本内 `source ~/.zshrc` — 不可行，`curl | sh` 在子 shell 执行，export 无法传播到父 shell
- 方案 C: 改为 `eval "$(curl ...)"` — 可行但有安全顾虑，且需要改变所有文档中的安装指令
- 方案 D: 仅提示绝对路径 — 可用但体验不够好，用户还是需要 PATH 配置才能长期使用

**理由**: 方案 B 零风险、零破坏性，且是行业惯例（rustup、Deno 均如此）。

### Decision 2: 按 shell 类型输出对应语法

根据 `configure_path()` 中已检测到的 `SHELL_NAME` 输出对应命令：

| Shell | 命令 |
|-------|------|
| bash/zsh | `export PATH="$HOME/.soulkiller/bin:$PATH"` |
| fish | `set -gx PATH $HOME/.soulkiller/bin $PATH` |
| PowerShell | `$env:Path = "$env:LOCALAPPDATA\soulkiller;$env:Path"` |

### Decision 3: 同时保留"新终端"提示

输出结构为两个选项并列：
```
  To use in this terminal:

    export PATH="$HOME/.soulkiller/bin:$PATH"

  Or open a new terminal window.
```

保留"新终端"作为备选，因为部分用户可能更习惯这种方式。

## Risks / Trade-offs

- **[风险] fish 语法差异** → 已在 `configure_path()` 中有 fish 分支，复用 `SHELL_NAME` 判断即可
- **[风险] 用户使用非登录 shell 或 tmux** → `$SHELL` 可能不反映实际 shell，但这与当前 PATH 写入逻辑面临相同问题，不在本次改动范围内
- **[Trade-off] 输出行数增加** → 安装完成消息多 2-3 行，可接受
