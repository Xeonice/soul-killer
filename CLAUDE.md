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
- `components/text-input.tsx` — Unified input with three completion modes: `completionItems` (slash commands), `argCompletionMap` (command arguments like `/use <soul>`), `pathCompletion` (filesystem paths). All mutually exclusive.
- `animation/` — Cyberpunk visual components: BootAnimation, ExitAnimation, RelicLoadAnimation, GlitchText, HeartbeatLine, MalfunctionError, SoulRecallPanel. All use `GlitchEngine` with seeded PRNG (`SOULKILLER_SEED` env var) for deterministic test output.

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
- `soul-capture-agent.ts` — AI agent that autonomously searches the web to gather soul data. Uses Vercel AI SDK (`generateText`) with tool calling. Classifies targets (DIGITAL_CONSTRUCT, PUBLIC_ENTITY, etc.) and applies per-classification search strategies (`strategies/`).
- `tools/` — Search tool factories for the agent (web search, content extraction)
- Emits `CaptureProgress` events for real-time UI updates in `SoulkillerProtocolPanel`

**Distill** — `src/distill/`
- `sampler.ts` → `extractor.ts` → `generator.ts`: Sample chunks → LLM feature extraction → generate identity.md/style.md/behaviors/*.md

**Tags** — `src/tags/`
- `taxonomy.ts` — 5-category tag system (personality, communication, values, behavior, domain) used in soul profiles
- `parser.ts` — Tag extraction/parsing utilities

**Soul** — `src/soul/`
- `manifest.ts` / `package.ts` — Soul packaging and manifest management for distributable soul archives

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
- **E2E tests** (`tests/e2e/`) — Full CLI interaction via real PTY using `Bun.spawn` terminal API. Uses `bun:test` (not vitest) because Bun.spawn requires the Bun global. 10 scenarios covering lifecycle, wizards, soul management, conversation, error paths, and tab completion.
- **Visual tests** (`tests/visual/`) — Playwright + xterm.js pixel comparison

Test fixtures live in `tests/integration/fixtures/` (sample markdown docs + twitter archive).

### E2E Test Architecture

```
tests/e2e/
├── scenarios.test.ts          → 10 test scenarios (uses bun:test)
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

## Color Palette

Cyberpunk 2077 theme defined in `src/cli/animation/colors.ts`:
- Cyan `#00F7FF` — primary
- Magenta `#ED1E79` — accent/Relic
- Yellow `#F3E600` — warning
- Red `#880425` — danger
- Background `#181818`

## OpenSpec

Project uses OpenSpec for change management. Specs at `openspec/specs/`, archived changes at `openspec/changes/archive/`. Workflow: `/opsx:explore` → `/opsx:propose` → `/opsx:apply` → `/opsx:archive`.
