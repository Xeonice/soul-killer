## Context

三份 README 的结构完全相同，只是语言不同。改动点集中在两处文案。

## Goals / Non-Goals

**Goals:**
- 让游玩方知道需要安装 soulkiller
- 反映 Windows 原生支持

**Non-Goals:**
- 不改安装命令
- 不改 README 的整体结构

## Decisions

### 1. "怎么玩"段落追加一句

在现有的"导入后作为 Skill 加载，即可开始游玩"之后追加：

- 中文: `接收方在首次游玩前也需要安装 soulkiller CLI——Skill 首次加载时会自动检测并提示安装。`
- 英文: `Recipients also need soulkiller CLI installed before their first play — the Skill automatically detects and prompts for installation on first load.`
- 日文: `受信者は初回プレイ前に soulkiller CLI のインストールが必要です——Skill は初回ロード時に自動検出し、インストールを案内します。`

### 2. 安装段落增加平台支持声明

在安装命令之前加一行平台说明：

- 中文: `支持 macOS、Linux 和 Windows。`
- 英文: `Supports macOS, Linux, and Windows.`
- 日文: `macOS、Linux、Windows に対応。`
