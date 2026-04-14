<h1 align="center">SOULKILLER</h1>

<p align="center">
  One command. Extract any person's digital footprint into a playable text adventure game.
</p>

<p align="center">
  <a href="./README.md">中文</a> · <strong>English</strong> · <a href="./README.ja.md">日本語</a>
</p>

---

> **To all division technical staff:**
>
> The SOULKILLER protocol's core mission: extract a target's "soul" from public data — identity, linguistic style, behavioral patterns — distill it into an AI character, and automatically generate a distributable interactive text adventure (visual novel). No code required from the operator.
>
> Enter a name to create a character, enter a world setting to build a world, then combine the two — and out comes a complete Galgame script.
>
> **Those classic regrets — now you can rewrite them yourself:**
>
> - **Fate/stay night — The Illya Route** — A dedicated Illyasviel route was planned during development but cut due to scheduling. She remains the only core heroine without her own route. For over a decade, fans have scrounged for fragments in FHA and Prisma Illya. Input "Illyasviel" + "Fate/Stay Night" → generate the route that never existed.
> - **White Album 2** — Touma Kazusa leaves for Vienna. The farewell in the airport snow is where all heartache-genre Galgames begin — even Kazusa's True End in coda carries irredeemable regret. Input "Touma Kazusa" + "White Album 2" → write an IF route where all three find redemption.
>
> Every exported `.skill` archive is a standalone visual novel — with state management, save/load, multiple scripts per story, affinity tracking, and branching endings. You don't need to write a single line of code.
>
> **How to play?** Exported `.skill` files run in any application that supports the Skill protocol — such as [Claude](https://claude.ai) or [OpenClaw](https://github.com/nicepkg/openclaw). Import it as a Skill, and start playing. Each script supports saving, a single story can have multiple generated scripts, and you can view the current script's choice branch tree at any time. Recipients also need soulkiller CLI installed before their first play — the Skill automatically detects and prompts for installation on first load. Also perfect for developers loading it in Claude Code's terminal — as far as your boss can tell, you're just "debugging an AI Skill."

## Installation

Supports macOS, Linux, and Windows. Binaries are distributed globally via Cloudflare CDN.

```bash
curl -fsSL https://soulkiller-download.ad546971975.workers.dev/scripts/install.sh | sh
```

For Windows environments, use PowerShell:

```powershell
irm https://soulkiller-download.ad546971975.workers.dev/scripts/install.ps1 | iex
```

After installation, copy and run the PATH command shown in the terminal to use immediately, or open a new terminal window and run `soulkiller` to launch.

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
| `/pack <name>` | Package a soul into a portable `.soul.pack` archive |
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
│  → Package as .skill archive         │
│  → Others load it and play           │
└─────────────────────────────────────┘
```

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
- **Hover to preview** — Hover nodes to see scene text and status

> The tree server auto-shuts down after 2 hours of inactivity.

## System Maintenance

```bash
soulkiller --version    # Confirm current protocol version
soulkiller --update     # Execute self-update to latest version
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

## License

This project is licensed under [GPL-3.0](./LICENSE).
