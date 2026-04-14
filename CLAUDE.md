# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What is Soulkiller

Soulkiller is a Cyberpunk 2077-themed CLI REPL that extracts "souls" from digital footprints (Markdown docs, Twitter archives) and creates distributable AI avatars. Users can create their own soul, distill it into identity/style/behavior files, and others can load and chat with the soul via RAG + LLM.

## Commands

```bash
# Run the REPL
bun run dev                    # or: bun src/index.tsx

# Build release binaries (5 platforms)
bun run build:release          # outputs to dist/

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
- `state/` — Runtime state management CLI. This directory is the single source of truth for **both sides** of the state lifecycle: Soulkiller's vitest suite imports these modules directly for unit testing, and the packager copies them byte-for-byte into every exported skill's `runtime/lib/` directory. All `.ts` files only use bun stdlib (zero npm dependencies) so they can be shipped into skills without a `node_modules` step. At runtime, the soulkiller binary itself serves as the execution engine via `soulkiller runtime <subcommand>` (uses `process.execPath` + `BUN_BE_BUN=1` to spawn itself and execute the external `.ts` files). Contains: `mini-yaml.ts` (flat yaml parser for state.yaml/meta.yaml), `schema.ts` (StateSchema types + applyDelta), `script.ts` (script.json loader), `io.ts` (atomic file I/O + SaveType/SavePaths types + MetaFile with currentRoute), `init.ts` / `apply.ts` / `validate.ts` / `rebuild.ts` / `reset.ts` / `save.ts` / `list.ts` / `history.ts` / `tree.ts` / `tree-server.ts` / `tree-html.ts` / `script-builder.ts` / `route.ts` (state CLI subcommands — 15+ total), `main.ts` (CLI dispatcher).
- `state/history.ts` — Choice history tracking. `apply` appends `scene-id:choice-id` to `history.log` per save directory. `save` copies, `reset` clears, `rebuild` ignores history.
- `state/tree.ts` + `tree-server.ts` + `tree-html.ts` — Branch tree visualization. `state tree <script-id>` spawns a detached Bun HTTP server (default port 6677) serving an interactive HTML page. SSE pushes real-time updates when history.log changes. Phase 2 auto-starts the tree server before first scene render. Nodes colored by route, gate scenes rendered as diamonds.
- `state/script-builder.ts` — Incremental script builder. Phase 1 uses Plan → Scene × N → Ending × M → Build flow instead of single-shot Write. `state script plan` validates + auto-computes predecessors / is_convergence / generation_order (topological sort). `state script scene` validates per-scene JSON + consequences + predecessors. `state script ending` validates ending body. `state script build` merges into final script.json. Supports `affinity_gate` scene type and `routes` array for branching narratives.
- `state/route.ts` — Affinity gate routing. `state route <script-id> <gate-scene-id>` evaluates routing conditions (reuses ending condition DSL: all_of/any_of/comparison) against current state, outputs matched route + next scene, writes `current_route` to meta.yaml.
- `lint/` — Author-side template lint runs inside the soulkiller process at export time. Catches yaml syntax bugs, schema-key naming violations, axis cross-reference mismatches between story-spec axes and SKILL.md schema examples, and (since skill-runtime-bun-state) runtime CLI consistency rules (`PHASE_MINUS_ONE_INSTALL_GUIDE_PRESENT`, `STATE_APPLY_PRESENT`, `NO_EDIT_STATE_YAML`). Failures log to stderr but never block export — by design, the author audits the report manually.
- The exported skill is a five-phase visual novel engine: Phase -1 (script library menu + load validation) → Phase 0 (length/seeds) → Phase 1 (script generation **and persistence**) → Phase 2 (scene runner) → Phase 3 (ending gallery).
- Every `script-<id>.json` carries an explicit top-level **state_schema** object — a flat dictionary keyed by quoted literal strings (`"affinity.judy.trust"`, `"flags.met_johnny"`, `"custom.location"`). Each field declares `desc / type / default` plus `range` (int) or `values` (enum). Allowed types: `int / bool / enum / string` only. (The file is JSON, not YAML — see the skill-runtime-bun-state change below.)
- **Three-layer state model** (story-level-state change): (1) **shared axes** — every character has `bond` + 2 story-defined shared axes (locked in by export agent's `set_story_state` tool, identical across cast, per-character `shared_initial_overrides` allow tuning initial values); (2) **specific axes** — each character may declare 0–2 unique axes; (3) **flags** — story-level flag vocabulary defined once in `story_state` and used as a strict whitelist by Phase 1. This enables cross-character aggregation via `all_chars` / `any_char` DSL primitives (axis must be a shared axis; optional `except` list excludes characters). Phase -1 runs **six-fold** load validation (shared-axes completeness + flag-set equality added). Export-time lint `SHARED_AXES_COMPLETENESS` sanity-checks template yaml examples.
- **Prose style anchor** (prose-style-anchor change): every new export is required to call `set_prose_style` (Step 3 in the 6-step workflow) before any `add_character`. The tool locks in a story-level `ProseStyle` (target_language: 'zh'|'en'|'ja' / voice_anchor / forbidden_patterns / ip_specific / optional character_voice_summary) that downstream Phase 1/2 LLMs must obey as a hard constraint to eliminate translatese. Anti-translatese pattern libraries: `src/export/support/zh-translatese-patterns.ts` (Chinese) and `src/export/support/ja-translatese-patterns.ts` (Japanese); English exports skip anti-translatese. The `set_prose_style` tool accepts `forbidden_patterns` as a structured object array (`[{id, bad, good, reason}]`), not CSV. `ExportBuilder.build()` throws if prose_style is missing — the fallback branch in templates only exists for legacy archives loaded on the player side.
- **Phase 1 incremental script generation** (skill-incremental-script change): Phase 1 uses a Plan → Scenes → Endings → Build pipeline instead of single-shot Write. Step A: LLM generates a plan.json (narrative blueprint with scene outlines, character arcs, context_refs, and route structure — no scene text). CLI auto-computes predecessors, is_convergence, and topological generation_order. Step B: LLM generates each scene individually in topological order, reading plan + predecessors + context_refs for coherence. Convergence scenes (is_convergence) must be path-neutral. Step C: Endings generated after all scenes, based on actual scene content + character_arcs key_scenes. Step D: CLI merges into final script.json. Step E: Simplified self-check (prose style + data coverage only; structural checks done incrementally). Each step validated by CLI — JSON errors isolated to individual scenes. Full-read enforcement and budget anchors still apply.
- **Phase 2 scene runner**: Scene transition rules enumerate 4 stop situations (scene end + AskUserQuestion / 💾 save flow / free-text reply + AskUserQuestion / ending). apply_consequences → render-next-scene is atomic. Every AskUserQuestion appends "💾 Save current progress" as the only non-script option. Choices ≤ 3 per scene (+ 💾 = max 4 options, respecting AskUserQuestion limit). Branch tree visualization auto-starts before first scene render.
- **Route system** (skill-route-system change): Classic Galgame route model — shared common route → affinity_gate (好感度+flag 判定) → character-specific routes → route-specific endings. `affinity_gate` is a special scene type with `routing` array evaluated by `state route` command. Each routing entry has `route_id` + `condition` (reuses ending condition DSL) + `next`. Routes don't converge — each runs to its own endings. Phase 2 auto-routes at gate (no AskUserQuestion), ending evaluation scoped to `meta.yaml.current_route`. Tree visualization colors nodes by route.
- **Export agent route pipeline** (export-route-pipeline change): Planning prompt analyzes route potential per character, outputs `route_candidates` in plan. After Character Loop, `route-selection.ts` presents multi-select list (agent-recommended pre-selected, max 4) for user confirmation. Selected characters → `builder.setRouteCharacters()` → story-spec Routes section → SKILL.md mandatory route instructions (when routes defined). Tools `set_story_metadata` and `set_story_state` use structured object arrays instead of CSV strings.
- All `consequences` references and all `endings.condition` keys must be **literal copies** of state_schema keys. consequences semantics: `int` is delta (add/subtract); `bool / enum / string` are absolute overwrite. endings use a structured DSL with comparison nodes (`{ key, op, value }`) and boolean nodes (`all_of / any_of / not / all_chars / any_char`); the last ending must use `condition: default` as the fallthrough.
- Runtime persistence layout inside the skill archive:
  - `runtime/scripts/script-<id>.json` — Phase 1 writes one JSON file per generated script (JSON, not YAML — see skill-runtime-bun-state below)
  - `runtime/saves/<script-id>/auto/state.yaml` — flat literal-string-keyed dictionary, one field per line. **Written exclusively by `runtime/lib/*.ts` via the `state` CLI, never by LLM Edit/Write tools.** The state CLI uses temp-file + `rename` for atomic transactional writes (state.yaml + meta.yaml updated as a single unit).
  - `runtime/saves/<script-id>/auto/meta.yaml` — `script_ref` binds the save to a specific script
  - `runtime/saves/<script-id>/manual/<timestamp>/` — manual save snapshots (up to 3 per script), created by `state save`
  - `runtime/lib/*.ts` — bun TypeScript implementation layer. Zero npm dependencies (uses only bun stdlib + inline mini-yaml parser). Executed by the soulkiller binary via `soulkiller runtime <subcommand>` (cross-platform, no shell dependency). LLM never reads or references these files directly.
- Phase -1 runs **six-fold** validation via `soulkiller runtime validate <script-id> [<save-type>]` which returns structured JSON: (1) `DANGLING_SCRIPT_REF`, (2) `STATE_SCHEMA_MISSING`, (3) `INITIAL_STATE_MISMATCH`, (4) `CONSEQUENCES_UNKNOWN_KEY`, (5) `SHARED_AXES_INCOMPLETE`, (6) `FLAGS_SET_MISMATCH`. Continue-game (`--continue` flag) adds a 7th check on state.yaml field-set alignment (`FIELD_MISSING` / `FIELD_EXTRA` / `FIELD_TYPE_MISMATCH`) and the repair menu dispatches to `state rebuild` or `state reset` — LLM never hand-patches the yaml.
- "Start over" dispatches to `soulkiller runtime reset <script-id>`, which reloads `script.initial_state` atomically. "Generate new script" in Phase -1 is the only way to create a fresh story.
- **per-script-save-system change**: Save model changed from 3 fixed global `slot-{1,2,3}` to per-script directories (`runtime/saves/<script-id>/auto/` + `manual/<timestamp>/`). Each script gets 1 auto-save (updated every choice via `state apply`) + up to 3 manual saves (created by `state save` when user selects 💾). Phase -1 redesigned as flat script list with save-status annotations; selecting a script with saves shows an auto/manual/restart sub-menu. `state save <script-id> [--overwrite <timestamp>]` and `state list <script-id>` are new CLI subcommands (8 total). Old `slot` parameter removed from all subcommand signatures.
- **skill-runtime-bun-state change**: Phase 2 state writes moved from LLM `Edit` calls to a bun CLI shipped inside the archive. Errors B (clamp miscalculation), C (missed consequences key), D (wrong type), E (state/meta desync) are now **structurally impossible** because consequences math happens in TypeScript, not LLM prose. Error F (LLM skips `state apply` entirely) is still possible but falls outside this change's scope. script format changed from YAML to JSON because runtime/lib cannot ship a YAML parser without a node_modules dependency — `JSON.parse` is built into bun. state.yaml and meta.yaml stay as yaml (human-readable save files, parsed by the ~40-line `mini-yaml.ts`).
- **skill-runtime-binary change**: Shell wrappers (`state.sh`, `doctor.sh`) and separate bun bootstrap removed. The soulkiller binary itself serves as the cross-platform runtime entry point via `soulkiller runtime <subcommand>`. The binary embeds bun runtime via `bun build --compile`; at runtime it spawns itself (`process.execPath` + `BUN_BE_BUN=1`) to execute the skill archive's `runtime/lib/main.ts`. This enables full Windows support (PowerShell, Git Bash, cmd) without any shell dependency. `src/cli/runtime.ts` is the entry point; supports `--root <path>` for manual/dev use. Prerequisite changed from "Unix shell + separate bun" to "soulkiller binary installed".

**i18n** — `src/infra/i18n/`
- Supports zh/ja/en via JSON locale files. `t(key, params)` for interpolated translations. Locale set from config.
- **Dual-layer export architecture**: SKILL.md / story-spec.md engine instructions are in English (lingua franca); narrative instructions follow `prose_style.target_language`.
- Export agent prompts (`src/export/agent/prompts.ts`) and tool descriptions (`story-setup.ts`) are in English.
- Dimension definitions (`soul-dimensions.ts`, `world-dimensions.ts`) have localized display/description/qualityCriteria via `getLocalizedSoulDimensions(lang)` / `getLocalizedWorldDimensions(lang)`.
- Prose style: `zh-translatese-patterns.ts` (Chinese), `ja-translatese-patterns.ts` (Japanese); English exports skip anti-translatese.

**Tool Call Robustness** — `src/infra/utils/repair-tool-call.ts`
- Three-layer defense against LLM tool calling errors (array params sent as strings):
  - **Layer 1**: `inputExamples` on all tools with array params — shows model correct format
  - **Layer 2**: `strict: true` on critical export tools (`set_prose_style`, `set_story_metadata`)
  - **Layer 3**: `experimental_repairToolCall` on all `ToolLoopAgent` instances — local repair of string-encoded arrays (no extra LLM call)
- `set_prose_style` tool uses structured object arrays (`forbidden_patterns: [{id, bad, good, reason}]`, `voice_summaries: [{character_name, summary}]`) instead of CSV strings with custom delimiters.

**LLM** — `src/llm/`
- Uses both OpenAI SDK and Vercel AI SDK (`@ai-sdk/openai-compatible`) with OpenRouter base URL. All models accessed via single OpenRouter API key.
- `stream.ts` — `streamChat()` async generator yielding text chunks

**Config** — `src/config/`
- Stored at `~/.soulkiller/config.yaml`. Souls stored at `~/.soulkiller/souls/<name>/`.

**Docker Engine** — `engine/` (Python)
- `main.py` — FastAPI with /ingest, /recall, /status endpoints
- Not required — LocalEngine is the zero-dependency fallback

## Release & Distribution

- **Build**: `bun scripts/build.ts` — two-phase build: bundle (stub `react-devtools-core` via plugin, inject version) → cross-compile 5 platforms via `bun build --compile --target`. Outputs `.tar.gz` (Unix) and `.zip` (Windows) to `dist/`.
- **CI**: `.github/workflows/release.yml` — triggered by `v*` tag push. Single ubuntu runner cross-compiles all targets, runs tests first, then creates GitHub Release with all archives + install scripts.
- **Install**: `scripts/install.sh` (macOS/Linux) and `scripts/install.ps1` (Windows). Detect platform, download binary from GitHub Release, install to `~/.soulkiller/bin/`, configure PATH.
- **Self-update**: `soulkiller --update` queries GitHub API for latest release, verifies the downloaded archive against `checksums.txt`, and delegates replacement to `atomicReplaceBinary(src, dst)` in `src/cli/updater.ts`. Platform logic is unified inside that primitive: Unix uses `rename` (with `EXDEV` fallback to read+write); Windows uses the rename-self trick (rename running exe to `<exe>.old`, write new binary at original path), the same pattern Deno's `deno upgrade` uses. Failures are reported via typed `ReplaceFailure` codes (`LOCKED` / `PERMISSION` / `DISK_FULL` / `UNKNOWN`). On Windows, `<exe>.old` lingers briefly and is cleaned on the next cold start via `cleanupStaleOld()` in `src/index.tsx`.
- **Version**: Injected at build time via `process.env.SOULKILLER_VERSION`. `soulkiller --version` prints it. Dev mode falls back to `dev`.

## Testing

- **Unit tests** (`tests/unit/`) — Directory structure mirrors `src/`: `cli/`, `config/`, `export/` (with `state/`, `support/`, `pack/`, `agent/`), `infra/` (with `agent/`, `ingest/`, `search/`, `i18n/`, `utils/`), `soul/` (with `capture/`, `distill/`, `tags/`), `world/` (with `capture/`, `tags/`), `acceptance/`. To find a test, mirror the source path: `src/export/state/apply.ts` → `tests/unit/export/state/apply.test.ts`.
  - **Skill runtime state tests** (`tests/unit/export/state/*.test.ts`) — Cover the full state CLI pipeline that ships inside every exported skill: `mini-yaml.ts` parse/serialize round-trips (26 tests), `schema.ts` applyDelta semantics (33 tests), `init.ts` per-script auto initialization (6 tests), `apply.ts` consequences transactions (9 tests), `validate.ts` six-fold + continue-game diagnostics (11 tests), `rebuild.ts` / `reset.ts` recovery (5 tests), `list.ts` save enumeration (4 tests), `save.ts` manual snapshot lifecycle (6 tests). Tests import directly from `src/export/state/` — the same code the packager copies into `runtime/lib/`.
  - **Packager runtime tests** (`tests/unit/export/packager-runtime.test.ts`) — Verify `injectRuntimeFiles` copies all state CLI `.ts` files byte-for-byte to `runtime/lib/`, and that `countMdFilesInMap` / `estimateMdTextSizeKb` exclude `runtime/` from Phase 1 context budget.
- **Component tests** (`tests/component/`) — ink-testing-library snapshots for UI components. Subdirectories mirror `src/cli/`: `animation/`, `components/`, `commands/` (with `soul/`, `system/`, `export/`, `world/`).
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
