<h1 align="center">SOULKILLER</h1>

<p align="center">
  一条指令，从任意人物的数字足迹生成可游玩的文字冒险游戏。
</p>

<p align="center">
  <strong>中文</strong> · <a href="./README.en.md">English</a> · <a href="./README.ja.md">日本語</a>
</p>

---

> **致各事业部技术人员：**
>
> SOULKILLER 协议的核心任务：从公开数据中提取目标人物的"灵魂"——身份、语言风格、行为模式——将其蒸馏为 AI 角色，并自动生成可分发的互动式文字冒险（视觉小说）。操作者无需编写任何代码。
>
> 输入名字创建角色，输入世界观创建世界，然后将二者合二为一，便生成一部完整的 Galgame 剧本。
>
> **那些经典的遗憾，现在可以自己重写：**
>
> - **Fate/stay night — 伊莉雅线** — 原作开发中曾计划伊莉雅专属路线，因工期砍掉，她成了唯一没有自己线路的核心女主。十多年来玩家只能在 FHA 片段和魔伊外传中寻找碎片。输入「伊莉雅丝菲尔」+「Fate/Stay Night」→ 生成那条从未存在过的伊莉雅线
> - **白色相簿2** — 冬马和纱远赴维也纳，机场大雪中的永别是所有胃疼 Gal 的起点，即便 coda 的冬马 TE 也带着无法消解的遗憾。输入「冬马和纱」+「白色相簿2」→ 写一条三人都能被救赎的 IF 线
>
> 每一个导出的 `.skill` 档案都是一部独立可运行的视觉小说——带有状态管理、存档读档、单故事多剧本选择、好感度追踪和多结局分支。你不需要写一行代码。
>
> **怎么玩？** 导出的 `.skill` 文件可以在任何支持 Skill 协议的应用中直接运行——比如 [Claude](https://claude.ai) 或 [OpenClaw](https://github.com/nicepkg/openclaw)。导入后作为 Skill 加载，即可开始游玩。每个剧本支持存档，同一个故事可以生成多个不同剧本，随时查看当前剧本的选择分支线。接收方在首次游玩前也需要安装 soulkiller CLI——Skill 首次加载时会自动检测并提示安装。也特别适合开发者在 Claude Code 终端里加载——在老板眼皮底下，你只是在"调试 AI Skill"而已。

## 前置准备

SOULKILLER 需要以下 API 密钥才能运行。请在安装前完成注册：

| 服务 | 用途 | 是否必须 | 获取地址 |
|------|------|:--------:|----------|
| [OpenRouter](https://openrouter.ai/keys) | LLM 推理（角色蒸馏、世界构建、剧本生成） | **必须** | https://openrouter.ai/keys |
| [Tavily](https://app.tavily.com/home) | Web 搜索（采集数字足迹） | 二选一 | https://app.tavily.com/home |
| [Exa](https://dashboard.exa.ai/api-keys) | Web 搜索（替代 Tavily） | 二选一 | https://dashboard.exa.ai/api-keys |

> **说明：** 搜索服务在 Tavily 和 Exa 中选一个即可。首次启动时配置向导会引导你逐步填入这些密钥。

## 安装

支持 macOS、Linux 和 Windows。二进制通过 Cloudflare CDN 全球加速分发。

```bash
curl -fsSL https://soulkiller-download.ad546971975.workers.dev/scripts/install.sh | sh
```

Windows 环境使用 PowerShell：

```powershell
irm https://soulkiller-download.ad546971975.workers.dev/scripts/install.ps1 | iex
```

安装完成后，按终端提示复制执行 PATH 命令即可立即使用，或打开新的终端窗口，执行 `soulkiller` 启动。

> **为什么先装 soulkiller？** 下面的预制档案库（Skill/Soul/World）都依赖 soulkiller 二进制作为运行时：
> - `.skill` 档案在 Claude Code / OpenClaw 中游玩时，由 soulkiller 执行状态管理、存档读档、分支树可视化等逻辑
> - `.soul.pack` / `.world.pack` 档案通过 REPL 里的 `/unpack` 指令导入
>
> 所以请先完成安装，再继续下一节。

## 预制档案库

不想从零开始？以下预制档案托管于 Cloudflare R2，覆盖 Fate/Zero、三国、白色相簿2 和赛博朋克 2077 四个宇宙。

### Skill 档案 — 直接下载，立刻开玩

`.skill` 是 zip 归档，解压到 Claude Code 或 OpenClaw 的 skills 目录后即可加载游玩。下面用 `fate-zero` 举例，三款 skill 同理（替换文件名即可）。

| 档案 | 世界 | 说明 |
|------|------|------|
| [fate-zero.skill](https://soulkiller-download.ad546971975.workers.dev/examples/skills/fate-zero.skill) | Fate/Zero | 第四次圣杯战争，含伊斯坎达尔、言峰绮礼、卫宫切嗣等完整卡司 |
| [three-kingdoms.skill](https://soulkiller-download.ad546971975.workers.dev/examples/skills/three-kingdoms.skill) | 三国 | 乱世争霸，曹操、刘备、诸葛亮等群雄并立 |
| [white-album-2.skill](https://soulkiller-download.ad546971975.workers.dev/examples/skills/white-album-2.skill) | 白色相簿2 | 冬马和纱、小木曾雪菜的遗憾与救赎 IF 线 |

**Claude Code**

Claude Code 从 git 仓库根目录的 `.claude/skills/` 查找 skill。请在正确位置执行：

```bash
# 安装到当前项目（在 git 仓库根目录执行）
mkdir -p .claude/skills/fate-zero && \
  curl -sL https://soulkiller-download.ad546971975.workers.dev/examples/skills/fate-zero.skill -o /tmp/fate-zero.skill && \
  unzip -q /tmp/fate-zero.skill -d .claude/skills/fate-zero

# 或安装到全局（所有项目都能用）
mkdir -p ~/.claude/skills/fate-zero && \
  curl -sL https://soulkiller-download.ad546971975.workers.dev/examples/skills/fate-zero.skill -o /tmp/fate-zero.skill && \
  unzip -q /tmp/fate-zero.skill -d ~/.claude/skills/fate-zero
```

**OpenClaw**

```bash
mkdir -p ~/.openclaw/workspace/skills/fate-zero && \
  curl -sL https://soulkiller-download.ad546971975.workers.dev/examples/skills/fate-zero.skill -o /tmp/fate-zero.skill && \
  unzip -q /tmp/fate-zero.skill -d ~/.openclaw/workspace/skills/fate-zero
```

> 未安装 soulkiller 会在 Skill 首次加载时自动提示；如已按上一节安装则无需再动。

### Soul 档案 — 批量导入所有角色

包含全部 55 个角色（三国、Fate/Zero、Fate/Stay Night、白色相簿2、赛博朋克2077），一次导入即可全部到位。在 soulkiller REPL 里执行：

```bash
# 一次性安装全部角色（默认跳过本地已有）
/unpack https://soulkiller-download.ad546971975.workers.dev/examples/all-souls.soul.pack

# 覆盖本地已有版本
/unpack https://soulkiller-download.ad546971975.workers.dev/examples/all-souls.soul.pack --overwrite

# 安装后直接对话
/use 伊斯坎达尔
```

### World 档案 — 批量导入所有世界

包含全部 6 个世界观，安装后可用 `/create` 创建自己的角色并绑定到任意世界。同样在 soulkiller REPL 里执行：

```bash
# 安装全部世界
/unpack https://soulkiller-download.ad546971975.workers.dev/examples/all-worlds.world.pack

# 创建角色并绑定
/create 貂蝉
/world bind 三国
/export 貂蝉
```

## 30 秒速览

```bash
# 第一步：创建角色灵魂
/create johnny           # AI 代理自动搜索、采集、蒸馏目标人物

# 第二步：构建世界观
/world create cyberpunk  # 创建世界，定义规则、背景、编年史

# 第三步：导出为可游玩的文字冒险
/export johnny           # 将灵魂 × 世界打包为视觉小说 Skill 档案
```

角色 → 世界 → 导出。三步完成一部可分发的文字冒险游戏，全程由 AI 代理自动执行。

## 核心操作指令

**阶段一：角色**

| 指令 | 功能 |
|------|------|
| `/create <name>` | 创建灵魂构体 — AI 代理自动搜索目标数据并蒸馏 |
| `/use <name>` | 装载已有灵魂，进入对话模式 |
| `/distill <name>` | 对已有灵魂执行蒸馏，生成 identity/style/behavior 文件 |
| `/evolve <name>` | 向灵魂注入新数据源，增量进化 |

**阶段二：世界**

| 指令 | 功能 |
|------|------|
| `/world create <name>` | 创建世界观 — AI 代理自动搜索并蒸馏世界设定 |
| `/world bind <name>` | 将灵魂绑定到世界中 |
| `/world list` | 列出所有已创建的世界 |

**阶段三：导出**

| 指令 | 功能 |
|------|------|
| `/export <name>` | 将灵魂 × 世界导出为可游玩的文字冒险视觉小说 Skill 档案 |
| `/pack` | 全量打包：所有 Soul 打成 `all-souls.soul.pack`，所有 World 打成 `all-worlds.world.pack` |
| `/pack soul\|world <name>` | 打包单个 Soul 或 World |
| `/unpack <file>` | 解包 pack 文件（bundle 或单体，交互式冲突解决） |
| `/unpack <dir>` | 批量解包目录下所有 pack 文件（`--overwrite` 覆盖已有） |
| `/help` | 显示完整指令列表 |

## 完整流程

```
第一步：创建角色
/create johnny
┌─────────────────────────────────────┐
│  1. 输入目标名称与描述               │
│  2. 选择数据源（Web 搜索）           │
│  3. AI 代理自动采集数字足迹          │
│  4. 蒸馏提取身份/风格/行为特征       │
│  5. 灵魂构体就绪                     │
└─────────────────────────────────────┘

第二步：构建世界
/world create nightcity
┌─────────────────────────────────────┐
│  1. 输入世界名称与描述               │
│  2. AI 代理搜索世界观设定            │
│  3. 蒸馏规则/背景/编年史             │
│  4. 将角色绑定到世界                 │
└─────────────────────────────────────┘

第三步：导出游戏
/export johnny
┌─────────────────────────────────────┐
│  → 基于角色 × 世界生成冒险脚本       │
│  → 打包为 .skill 可分发档案          │
│  → 他人加载即可游玩                  │
└─────────────────────────────────────┘
```

## 游玩时的分支树可视化

导出的 `.skill` 档案在游玩时会自动启动一个本地分支树可视化服务，帮助你追踪当前的剧情走向。

<p align="center">
  <img src="https://a1f14yslixes7la8.public.blob.vercel-storage.com/CleanShot%202026-04-13%20at%2011.04.40%402x.png" alt="Branch Tree Visualization" width="800" />
</p>

**功能特性：**

- **实时更新** — 每次做出选择后，浏览器自动刷新，新节点亮起，选择路径高亮
- **好感度门 (Gate)** — 菱形节点标记路线分叉点，系统根据累积好感度自动路由到对应角色路线
- **路线着色** — 不同角色路线用不同颜色区分（cyan / magenta / yellow / green）
- **进度统计** — 右上角显示已探索场景数、选择次数、已发现结局数
- **拖拽平移** — 鼠标拖拽画布浏览完整的剧情分支树
- **悬停查看** — 鼠标悬停节点查看场景文本摘要和状态

> 分支树服务在 2 小时无连接后自动关闭，不需要手动清理。

## 系统维护

```bash
soulkiller --version    # 确认当前协议版本
soulkiller --update     # 执行自我更新至最新版本
```

## 数据存储

所有灵魂数据与配置存储于 `~/.soulkiller/`：

```
~/.soulkiller/
├── config.yaml          # 系统配置（API 密钥、语言等）
├── souls/<name>/        # 各灵魂构体数据
├── worlds/<name>/       # 世界观数据
└── exports/             # 导出的 Skill 档案
```

## 许可协议

本项目采用 [GPL-3.0](./LICENSE) 开源协议。
