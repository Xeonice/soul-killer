# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What is Soulkiller

Soulkiller is a Cyberpunk 2077-themed CLI REPL that extracts "souls" from digital footprints (Markdown docs, Twitter archives) and creates distributable AI avatars. Users can create their own soul, distill it into identity/style/behavior files, and others can load and chat with the soul via RAG + LLM.

## Commands

```bash
# Run the REPL
bun run dev                    # or: bun src/index.tsx

# Type checking (no JS output)
bun run build                  # tsc --noEmit

# Tests
bun run test                   # unit + component tests (vitest under bun)
bun run test:integration       # integration tests (real fs + LLM calls)
bun run test:watch             # vitest watch mode
bun run test:e2e               # E2E tests (bun:test + Bun.spawn PTY)
bun run test:visual            # visual snapshot tests (Playwright + xterm.js)

# Run a single test file
bun vitest run tests/unit/command-parser.test.ts
bun vitest run tests/component/prompt.test.tsx

# Run a single E2E scenario
bun test tests/e2e/ --test-name-pattern "cold boot"
```

## Runtime

Project uses **Bun** as the sole runtime — no Node.js dependency. Package manager is bun (`bun.lock`). Entry point uses `#!/usr/bin/env bun` and `await waitUntilExit()` for clean exit codes.

## Architecture

```
src/index.tsx          → CLI entry, renders <App /> with ink
src/cli/app.tsx        → Main state machine (boot → setup → idle → command → exit)
                         AppState tracks: phase, promptMode, soulName, soulDir,
                         interactiveMode, commandOutput, engine ref, conversation history
```

### Key Layers

**CLI (ink/React)** — `src/cli/`
- `app.tsx` — Root component with command router (`handleInput` switch). Interactive commands (create, use, publish, link, feed, distill) set `interactiveMode: true` which hides the main TextInput to avoid ink's global `useInput` broadcast conflicts.
- `command-registry.ts` — Single source of truth for all commands. Used by help, command parser, and slash completion.
- `components/text-input.tsx` — Unified input with cursor-position editing (←→ move, Option+Arrow word jump, Option+Backspace delete word, Ctrl+A/E home/end, Ctrl+W delete word, Ctrl+U/K delete to start/end) and three completion modes: `completionItems` (slash commands), `argCompletionMap` (command arguments like `/use <soul>`), `pathCompletion` (filesystem paths). All mutually exclusive.
- `animation/` — Cyberpunk visual components: BootAnimation, ExitAnimation, RelicLoadAnimation, GlitchText, HeartbeatLine, MalfunctionError, SoulRecallPanel, BatchProtocolPanel. All use `GlitchEngine` with seeded PRNG (`SOULKILLER_SEED` env var) for deterministic test output.

**Engine** — `src/engine/`
- `adapter.ts` — `EngineAdapter` interface (ingest, recall, status)
- `local-engine.ts` — In-process TF-IDF search + JSON storage (MVP, no heavy deps)
- `docker-engine.ts` — HTTP client to Python FastAPI engine on port 6600
- `detect.ts` — Auto-detects Docker availability, falls back to LocalEngine silently

**Ingest** — `src/ingest/`
- `types.ts` — `SoulChunk` interface (id, source, content, timestamp, context, type, metadata)
- `markdown-adapter.ts` / `twitter-adapter.ts` — Data source adapters implementing `DataAdapter`
- `pipeline.ts` — Orchestrates adapters, emits progress events

**Agent** — `src/agent/`
- `soul-capture-agent.ts` — AI agent that autonomously searches the web to gather soul data. Uses Vercel AI SDK (`ToolLoopAgent`) with tool calling. Classifies targets (DIGITAL_CONSTRUCT, PUBLIC_ENTITY, etc.) and applies per-classification search strategies (`strategies/`).
- `capture-agent.ts` — Generic capture loop shared by Soul/World. Two-phase search: pre-search with raw name (before agent loop), then agent refines with hint context. Extracts clean error messages from API errors (402/401/429). Watchdog timeout (90s no-progress) aborts stuck streams via AbortController.
- `batch-pipeline.ts` — Parallel batch creation pipeline. Runs multiple souls through capture→distill concurrently (max 3). Flow-style: each soul's distill starts immediately after its capture, without waiting for others. Failure isolation, retry support.
- `tools/` — Search tool factories for the agent (web search, content extraction). `runSearch()` exported for pre-search use outside agent loop.
- Emits `CaptureProgress` events for real-time UI updates in `SoulkillerProtocolPanel`

**Distill** — `src/distill/`
- `sampler.ts` → `extractor.ts` → `generator.ts`: Sample chunks → LLM feature extraction → generate identity.md/style.md/behaviors/*.md

**Tags** — `src/tags/`
- `taxonomy.ts` — 5-category tag system (personality, communication, values, behavior, domain) used in soul profiles
- `parser.ts` — Tag extraction/parsing utilities

**Soul** — `src/soul/`
- `manifest.ts` / `package.ts` — Soul packaging and manifest management for distributable soul archives

**World** — `src/world/`
- `entry.ts` / `manifest.ts` / `binding.ts` / `context-assembler.ts` / `resolver.ts` / `template.ts` — World entries, bindings, and prompt assembly
- `chronicle.ts` — World **chronicle** layer (timeline of major events, two-tier structure)
  - `worlds/<name>/chronicle/timeline/<slug>.md` — background layer, one-line entries, `mode: always`, aggregated by ContextAssembler into a sorted "## 编年史" block injected after background+rule entries
  - `worlds/<name>/chronicle/events/<slug>.md` — detail layer, full event descriptions, `mode: keyword`, recalled on demand via the same path as `lore` entries
  - Same file stem in both directories implicitly links a timeline entry to its detail event
  - `sort_key: number` field is the timeline position (no fixed semantics — earth years, fractional months, Fate war numbers, Middle-earth ages all share the field). `display_time: string` is the human-readable label shown to the LLM
  - Distill agent's history dimension auto-extracts chronicle pairs from "major events" (concrete time anchor + impact beyond an individual + reference frequency); falls back to heuristic `sort_key` with `sort_key_inferred: false` flag for the interactive review UI
  - Chronicle is packaged into `.skill` archives at `world/chronicle/{timeline,events}/` so exported skills' Phase 1 LLM can use the timeline as canonical world facts

**Export / Skill format** — `src/export/`
- `skill-template.ts` / `story-spec.ts` / `packager.ts` — Generate the SKILL.md, story-spec.md and the `.skill` zip archive for distributable visual novel skills.
- The exported skill is a five-phase visual novel engine: Phase -1 (script library menu) → Phase 0 (length/seeds) → Phase 1 (script generation **and persistence**) → Phase 2 (scene runner) → Phase 3 (ending gallery).
- Runtime persistence layout inside the skill archive:
  - `runtime/scripts/script-<id>.yaml` — Phase 1 writes one file per generated script (yaml frontmatter + scenes/endings/initial_state)
  - `runtime/saves/slot-<N>/{meta.yaml,state.yaml}` — Phase 2 writes the active slot after every scene transition; `meta.script_ref` binds the save to a specific script
- "从头再来" replays the **same** script (resets state to `initial_state`); "生成新剧本" in Phase -1 is the only way to create a fresh story.

**i18n** — `src/i18n/`
- Supports zh/ja/en via JSON locale files. `t(key, params)` for interpolated translations. Locale set from config.

**LLM** — `src/llm/`
- Uses both OpenAI SDK and Vercel AI SDK (`@ai-sdk/openai-compatible`) with OpenRouter base URL. All models accessed via single OpenRouter API key.
- `stream.ts` — `streamChat()` async generator yielding text chunks

**Config** — `src/config/`
- Stored at `~/.soulkiller/config.yaml`. Souls stored at `~/.soulkiller/souls/<name>/`.

**Docker Engine** — `engine/` (Python)
- `main.py` — FastAPI with /ingest, /recall, /status endpoints
- Not required — LocalEngine is the zero-dependency fallback

## Testing

- **Unit tests** (`tests/unit/`) — Pure logic: adapters, parsers, config, glitch engine
- **Component tests** (`tests/component/`) — ink-testing-library snapshots for UI components
- **Integration tests** (`tests/integration/`) — Full ingest→recall pipeline with test fixtures; E2E with real LLM calls (requires valid API key in `~/.soulkiller/config.yaml`)
- **E2E tests** (`tests/e2e/`) — Full CLI interaction via real PTY using `Bun.spawn` terminal API. Uses `bun:test` (not vitest) because Bun.spawn requires the Bun global. 12 scenarios covering lifecycle, wizards, soul management, conversation, error paths, tab completion, export, and distill dimensions.
- **Visual tests** (`tests/visual/`) — Playwright + xterm.js pixel comparison

Test fixtures live in `tests/integration/fixtures/` (sample markdown docs + twitter archive).

### E2E Test Architecture

```
tests/e2e/
├── scenarios.test.ts          → 12 test scenarios (uses bun:test)
├── harness/
│   ├── test-terminal.ts       → Bun.spawn + terminal API, direct PTY control
│   └── mock-llm-server.ts     → HTTP server mimicking OpenAI chat completions
└── fixtures/
    ├── test-home.ts           → Isolated HOME dir with config.yaml (animation: false)
    └── soul-fixtures.ts       → Pre-built distilled/evolved soul data
```

Key details:
- `TestTerminal` spawns `bun src/index.tsx` in a real PTY — no IPC middle layer
- CI env vars (`CI`, `GITHUB_ACTIONS`) are removed from child process env because ink v6 suppresses dynamic rendering when CI=true
- Exit code comes from `proc.exited` (not `terminal.exit` callback, which reports PTY close status, not process exit code)
- `send()` writes chars one-by-one with 10ms delays for ink compatibility; `_killed` flag prevents writes after terminal close
- When writing `waitFor` patterns, avoid matching autocomplete menu text — use specific wizard/output text instead
- CI-friendly timeout constants: `SOUL_LOAD_TIMEOUT` (20s), `WIZARD_STEP_TIMEOUT` (10s), `INSTANT_TIMEOUT` (8s) — generous for CI where PTY I/O can be 3-5x slower
- The `/create` wizard now includes a `soul-list` step after description — E2E tests must navigate through it (down arrow to "Continue" + enter) before reaching tags

### Batch Create

`/create` supports batch mode: enter multiple souls in the `soul-list` step, then all are captured and distilled in parallel (max 3 concurrent). Key components:
- `src/agent/batch-pipeline.ts` — Concurrency pool, flow-style execution, failure isolation, retry
- `src/cli/animation/batch-protocol-panel.tsx` — Compact/detail dual-view progress panel (↑↓ select, Enter expand, Esc back)
- Batch mode skips manual tags input and search-confirm; data sources are selected once for all souls
- In `CreateCommand`, Esc during `batch-capturing` is NOT intercepted by the parent — `BatchProtocolPanel` handles it internally (detail→compact→cancel)

## Color Palette

Cyberpunk 2077 theme defined in `src/cli/animation/colors.ts`:
- Cyan `#00F7FF` — primary
- Magenta `#ED1E79` — accent/Relic
- Yellow `#F3E600` — warning
- Red `#880425` — danger
- Background `#181818`

## OpenSpec

Project uses OpenSpec for change management. Specs at `openspec/specs/`, archived changes at `openspec/changes/archive/`. Workflow: `/opsx:explore` → `/opsx:propose` → `/opsx:apply` → `/opsx:archive`.
