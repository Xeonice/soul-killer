<h1 align="center">SOULKILLER</h1>

<p align="center">
  One command. Turn any person's digital footprint into a playable text adventure game.
</p>

<p align="center">
  <a href="./README.md">中文</a> · <strong>English</strong> · <a href="./README.ja.md">日本語</a>
</p>

---

> **To all division technical staff:**
>
> The SOULKILLER protocol's core mission: extract a target's "soul" from public data — identity, linguistic style, behavioral patterns — distill it into an AI character, and automatically generate a distributable interactive text adventure (visual novel). No code required from the operator.
>
> Enter a name to create a character, enter a world setting to build a world, then fuse the two — and out comes a complete Galgame script.
>
> **Those classic regrets — now you can rewrite them yourself:**
>
> - **Fate/stay night — The Illya Route** — A dedicated Illyasviel route was planned during development but cut due to scheduling. She remains the only core heroine without her own route. For over a decade, fans have scrounged for fragments in FHA clips and the Prisma Illya spinoff. Input "Illyasviel" + "Fate/Stay Night" → generate the Illya route that never existed.
> - **White Album 2** — Touma Kazusa leaves for Vienna. The farewell in the airport snow is where every heartache-genre Gal begins — even Kazusa's True End in coda carries irredeemable regret. Input "Touma Kazusa" + "White Album 2" → write an IF route where all three find redemption.
>
> Every exported `.skill` archive is a standalone, runnable visual novel — with state management, save/load, multiple scripts per story, affinity tracking, and branching endings. You don't need to write a single line of code.
>
> **How to play?** Exported `.skill` files run in any application that supports the Skill protocol — such as [Claude](https://claude.ai) or [OpenClaw](https://github.com/nicepkg/openclaw). Import it as a Skill and start playing. Each script supports saving, a single story can have multiple generated scripts, and you can inspect the current script's choice branch tree at any time. Recipients also need the soulkiller CLI installed before their first play — the Skill auto-detects and prompts for installation on first load. Also perfect for developers loading it in the Claude Code terminal — as far as your boss can tell, you're just "debugging an AI Skill."

## Installation

Supports macOS, Linux, and Windows. Binaries are distributed globally via Cloudflare CDN.

```bash
curl -fsSL https://soulkiller-download.ad546971975.workers.dev/scripts/install.sh | sh
```

For Windows, use PowerShell:

```powershell
irm https://soulkiller-download.ad546971975.workers.dev/scripts/install.ps1 | iex
```

After installation, copy and run the PATH command shown in the terminal to use it immediately, or open a new terminal window and run `soulkiller` to launch.

> **Why install soulkiller first?** The pre-made archives below (Skill / Soul / World) all depend on the soulkiller binary as their runtime:
> - `.skill` archives played in Claude Code / OpenClaw rely on soulkiller to drive state management, save/load, branch-tree visualization, and more
> - `.soul.pack` / `.world.pack` archives are imported via the `/unpack` command inside the REPL
>
> So finish the install, then move on to the next section.

## Pre-made Archives

Don't want to start from scratch? The following pre-made archives are hosted on Cloudflare R2, covering four universes: Fate/Zero, Three Kingdoms, White Album 2, and Cyberpunk 2077.

### Skill archives — one-line CLI install

With soulkiller installed, a single command handles download + extract + placement — the exact same command works on Windows / Linux / macOS:

```bash
# Show the installable catalog
soulkiller skill catalog

# Install all three into the Claude Code global directory
soulkiller skill install --all --to claude-code

# Pick a single skill and push it to multiple targets at once
soulkiller skill install fate-zero --to claude-code --to codex --to openclaw

# Manage already-installed skills
soulkiller skill list                    # Scan installed + diff against catalog (shows which have updates)
soulkiller skill list --updates          # Only show those with updates
soulkiller skill list --examples         # Scan the repo's examples/skills/*.skill
soulkiller skill update fate-zero        # Pull the new catalog version and overwrite
soulkiller skill update --all --check    # dry-run: which ones have updates (CI-friendly; add --exit-code-if-updates to gate)
soulkiller skill info fate-zero          # Show install location / version / legacy runtime/bin warnings
soulkiller skill uninstall fate-zero     # Leaves a .old-<ts> backup (--no-backup to skip)
```

**`update` vs `upgrade`**: `skill update` pulls a newer skill package from the catalog (network); `skill upgrade` syncs the local `runtime/engine.md` with the current soulkiller binary (offline). Both coexist, each for its own scenario.

Available targets (`--to` can be repeated):

| Target | Global path | Notes |
|--------|-------------|-------|
| `claude-code` | `~/.claude/skills/` | opencode also auto-detects this path |
| `codex` | `~/.agents/skills/` | opencode also auto-detects this path |
| `opencode` | `~/.config/opencode/skills/` | opencode-native path |
| `openclaw` | `~/.openclaw/workspace/skills/` | OpenClaw-specific |

Currently installable:

<!-- SKILLS:START -->
<!-- This section is auto-generated by scripts/build-skill-catalog.ts — do not edit manually. -->

| slug | 世界 | 说明 |
|------|------|------|
| `cyberpunk-2077` | 2077 | 赛博朋克 2077 的故事 |
| `fate-stay-night` | FSN | 第五次圣杯战争 |
| `fate-zero` | Fate/Zero | 第四次圣杯战争，含伊斯坎达尔、言峰绮礼、卫宫切嗣等完整卡司 |
| `three-kingdoms` | 三国 | 乱世争霸，曹操、刘备、诸葛亮等群雄并立 |
| `white-album-2` | 白色相簿2 | 冬马和纱、小木曾雪菜的遗憾与救赎 IF 线 |
<!-- SKILLS:END -->

For a more interactive path: type `/install` (no arguments) inside the REPL to launch the multi-step wizard — pick skills → pick targets → preview the install matrix → execute. Append `--scope project`, or pick Project at step 3 of the wizard, to install into `<cwd>/.<target>/skills/` instead of the global path.

> If soulkiller isn't installed yet, run the self-install script from the previous section first. Recipients of a `.skill` file will also be prompted to install soulkiller as the Phase 2 runtime on first load. Cursor is not supported (no skills-directory convention). Direct download still works: `https://soulkiller-download.ad546971975.workers.dev/examples/skills/<slug>.skill`.

### Soul archives — bulk import every character

A bundle of all 55 characters (Three Kingdoms, Fate/Zero, Fate/Stay Night, White Album 2, Cyberpunk 2077). One import and they all land. Inside the soulkiller REPL:

```bash
# Install every character at once (skips existing by default)
/unpack https://soulkiller-download.ad546971975.workers.dev/examples/all-souls.soul.pack

# Overwrite existing local copies
/unpack https://soulkiller-download.ad546971975.workers.dev/examples/all-souls.soul.pack --overwrite

# Jump straight into conversation
/use 伊斯坎达尔
```

### World archives — bulk import every world

A bundle of all 6 world settings. Once installed, use `/create` to build your own characters and bind them to any world. Also inside the soulkiller REPL:

```bash
# Install every world
/unpack https://soulkiller-download.ad546971975.workers.dev/examples/all-worlds.world.pack

# Create a character and bind it
/create 貂蝉
/world bind 三国
/export 貂蝉
```

## Prerequisites

SOULKILLER's authoring pipeline (soul distillation / world building / script generation) needs the following API keys. **Skip this section if you only plan to play pre-made archives** — recipients just need to load a `.skill` file in Claude/OpenClaw.

| Service | Purpose | Required | Get Key |
|---------|---------|:--------:|---------|
| [OpenRouter](https://openrouter.ai/keys) | LLM inference (soul distillation, world building, script generation) | **Yes** | https://openrouter.ai/keys |
| [Tavily](https://app.tavily.com/home) | Web search (collecting digital footprints) | Either one | https://app.tavily.com/home |
| [Exa](https://dashboard.exa.ai/api-keys) | Web search (alternative to Tavily) | Either one | https://dashboard.exa.ai/api-keys |

> **Note:** Pick either Tavily or Exa for search — one is enough. The first-launch `/setup` wizard walks you through entering these keys; you can always rerun `/setup` later, or use `/config` for single-field tweaks.

## Using the soulkiller CLI

soulkiller itself is a **local launcher** — after installation, run `soulkiller` in your terminal to enter the REPL, where slash commands drive the full "character → world → export" pipeline. It also doubles as the Phase 2 runtime engine (state management, save/load, branch-tree visualization) that every `.skill` archive depends on. The three subsections below give you the quick-start rhythm, the full command reference, and a typical author workflow.

### 30-Second Overview

```bash
# Step 1: Create a character soul
/create johnny           # AI agent auto-searches, collects, distills target

# Step 2: Build a world
/world create cyberpunk  # Create world — define rules, lore, chronicles

# Step 3: Export as a playable text adventure
/export johnny           # Package soul × world into a visual novel Skill archive
```

Character → World → Export. Three steps to a distributable text adventure game, executed autonomously by the AI agent.

### CLI Command Reference

**Phase 1: Character**

| Command | Function |
|---------|----------|
| `/create <name>` | Create a soul construct — AI agent autonomously searches and distills target data |
| `/use <name>` | Load an existing soul and enter conversation mode |
| `/distill <name>` | Execute distillation on an existing soul, generating identity/style/behavior files |
| `/evolve <name>` | Inject new data sources into a soul for incremental evolution |

**Phase 2: World**

| Command | Function |
|---------|----------|
| `/world create <name>` | Create a world — AI agent auto-searches and distills world settings |
| `/world bind <name>` | Bind souls to a world |
| `/world list` | List all created worlds |

**Phase 3: Export**

| Command | Function |
|---------|----------|
| `/export <name>` | Export soul × world as a playable text adventure visual novel Skill archive |
| `/pack` | Bulk package: all Souls into `all-souls.soul.pack`, all Worlds into `all-worlds.world.pack` |
| `/pack soul\|world <name>` | Package a single Soul or World |
| `/unpack <file>` | Unpack a pack file (bundle or single, interactive conflict resolution) |
| `/unpack <dir>` | Batch unpack every pack file in a directory (`--overwrite` to overwrite existing) |

**Settings & distribution**

| Command | Function |
|---------|----------|
| `/install [<slug>]` | Install a prebuilt skill — multi-step wizard (pick skills / targets / scope / preview) |
| `/upgrade` | Download + replace the soulkiller binary from inside the REPL (current session keeps running the old version until `/exit` + restart) |
| `/setup` | Re-run the onboarding wizard, all fields pre-filled from current config |
| `/config` | Edit individual config entries (API key / model / language / search engine) |
| `/help` | Display the complete command reference |

### Author Workflow

```
Step 1: Create a Character
/create johnny
┌─────────────────────────────────────┐
│  1. Enter target name & description  │
│  2. Select data sources (Web search) │
│  3. AI agent collects digital traces │
│  4. Distill identity/style/behavior  │
│  5. Soul construct ready             │
└─────────────────────────────────────┘

Step 2: Build a World
/world create nightcity
┌─────────────────────────────────────┐
│  1. Enter world name & description   │
│  2. AI agent searches world lore     │
│  3. Distill rules/lore/chronicles    │
│  4. Bind characters to the world     │
└─────────────────────────────────────┘

Step 3: Export the Game
/export johnny
┌─────────────────────────────────────┐
│  → Generate adventure script from    │
│    character × world                 │
│  → Fill in the skill version         │
│    (first export 0.1.0; re-export    │
│    auto-suggests a patch bump)       │
│  → Package as a .skill archive       │
│  → Others load it and play           │
└─────────────────────────────────────┘
```

**Skill version**: This is the author's own semantic version, and it's distinct from the soulkiller binary version and the engine_version — three separate things:

- `version` (this field) — the skill version the author releases; it's what `soulkiller skill update` checks to decide whether a newer package is available
- `soulkiller_version` — the soulkiller binary version at build time (metadata)
- `engine_version` — the runtime contract version, synced via `skill upgrade` when soulkiller itself updates

Semver is recommended (`1.0.0`), but dates (`2026.04.15`) or custom formats are also accepted.

## Branch Tree Visualization During Play

Exported `.skill` archives automatically start a local branch tree visualization server during play, helping you track your current story progress.

<p align="center">
  <img src="https://a1f14yslixes7la8.public.blob.vercel-storage.com/CleanShot%202026-04-13%20at%2011.04.40%402x.png" alt="Branch Tree Visualization" width="800" />
</p>

**Features:**

- **Real-time updates** — Browser auto-refreshes after each choice, new nodes light up, chosen paths highlight
- **Affinity Gate** — Diamond nodes mark route branching points; the system auto-routes based on accumulated affinity
- **Route coloring** — Different character routes shown in distinct colors (cyan / magenta / yellow / green)
- **Progress stats** — Top-right shows explored scenes, choices made, endings found
- **Drag to pan** — Mouse drag to navigate the full branch tree
- **Hover to preview** — Hover nodes to see scene text summaries and state

> The tree server auto-shuts down after 2 hours of inactivity — no manual cleanup needed.

## System Maintenance

```bash
soulkiller --version    # Confirm the current protocol version
soulkiller --update     # Self-update to the latest version
```

## Data Storage

All soul data and configuration reside at `~/.soulkiller/`:

```
~/.soulkiller/
├── config.yaml          # System config (API keys, language, etc.)
├── souls/<name>/        # Individual soul construct data
├── worlds/<name>/       # World-building data
└── exports/             # Exported Skill archives
```

## 🚩 Friends

Huge thanks to the **LinuxDo** community for their support!

[![Community](https://img.shields.io/badge/Community-LINUXDO-blue?style=for-the-badge)](https://linux.do)

## License

This project is licensed under [GPL-3.0](./LICENSE).
