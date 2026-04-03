# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What is Soulkiller

Soulkiller is a Cyberpunk 2077-themed CLI REPL that extracts "souls" from digital footprints (Markdown docs, Twitter archives) and creates distributable AI avatars. Users can create their own soul, distill it into identity/style/behavior files, and others can load and chat with the soul via RAG + LLM.

## Commands

```bash
# Run the REPL
npm run dev                    # or: npx tsx src/index.tsx

# Build
npm run build                  # tsc → dist/

# Tests
npm test                       # unit + component tests (vitest)
npm run test:integration       # integration tests (real fs + LLM calls)
npm run test:watch             # vitest watch mode
npm run test:visual            # visual snapshot tests (Playwright + xterm.js)
npm run test:visual:update     # update visual baselines

# Run a single test file
npx vitest run tests/unit/command-parser.test.ts
npx vitest run tests/component/prompt.test.tsx

# Update snapshots after intentional visual changes
npx vitest run --update
```

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
- **Visual tests** (`tests/visual/`) — Playwright + xterm.js pixel comparison (infrastructure ready, tests pending heavy deps)

Test fixtures live in `tests/integration/fixtures/` (sample markdown docs + twitter archive).

## Color Palette

Cyberpunk 2077 theme defined in `src/cli/animation/colors.ts`:
- Cyan `#00F7FF` — primary
- Magenta `#ED1E79` — accent/Relic
- Yellow `#F3E600` — warning
- Red `#880425` — danger
- Background `#181818`

## OpenSpec

Project uses OpenSpec for change management. Specs at `openspec/specs/`, archived changes at `openspec/changes/archive/`. Workflow: `/opsx:explore` → `/opsx:propose` → `/opsx:apply` → `/opsx:archive`.
