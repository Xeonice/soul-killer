# Proposal: Remove Acceptance Framework

## Problem

The project has a `acceptance/` directory (~946 lines) that implements a spec-driven CLI acceptance testing framework. The framework reads YAML blocks embedded in `#### Scenario` sections of `openspec/specs/**/*.md` files and executes them via `bun run verify <spec-file>`.

However:
- Only 2 of 118 spec files have `acceptance` blocks written (`repl-shell`, `soul-conversation`)
- The E2E test suite (`tests/e2e/`) built later provides equivalent coverage: real PTY spawning, full CLI lifecycle, wizard flows, error paths, tab completion
- The acceptance framework duplicates the E2E harness capability but has far less coverage and is not integrated into CI

## Decision

Delete the `acceptance/` directory entirely. The E2E suite is the authoritative functional test layer going forward.

## Impact

- `acceptance/cli.ts`, `runner.ts`, `parser.ts`, `executors.ts`, `reporter.ts`, `fixtures.ts`, `types.ts` — deleted
- `package.json` scripts `verify` and `diagnose` — removed
- `openspec/specs/acceptance-cli/`, `openspec/specs/acceptance-dsl/`, `openspec/specs/acceptance-runner/` — these spec files describe the acceptance framework itself; they will be deleted as dead specs
- No production code changes; no test regressions (E2E covers the same scenarios)
