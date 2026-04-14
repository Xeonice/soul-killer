# Design: Remove Acceptance Framework

## What gets deleted

### `acceptance/` directory (7 files, ~946 lines)

| File | Role |
|------|------|
| `cli.ts` | Entry point — `verify` and `diagnose` commands |
| `runner.ts` | Reads spec.md, extracts YAML blocks, runs them |
| `parser.ts` | Parses YAML acceptance blocks |
| `executors.ts` | Step executors: spawn CLI, send input, waitFor, etc. |
| `reporter.ts` | PASS/FAIL output formatting |
| `fixtures.ts` | Isolated HOME dir for test runs |
| `types.ts` | Type definitions |

### `package.json` scripts

- `"verify": "bun acceptance/cli.ts verify"` — remove
- `"diagnose": "bun acceptance/cli.ts diagnose"` — remove

### Dead OpenSpec specs (describe the now-deleted framework)

- `openspec/specs/acceptance-cli/spec.md`
- `openspec/specs/acceptance-dsl/spec.md`
- `openspec/specs/acceptance-runner/spec.md`

## What is NOT changed

- `tests/e2e/` — the replacement, untouched
- All `openspec/specs/*/spec.md` files that happen to contain `acceptance` YAML blocks (`repl-shell`, `soul-conversation`) — the YAML blocks become inert comments; leave them in place (they document the scenario intent)
- No production source changes

## Rationale for keeping scenario YAML blocks in specs

The `#### Scenario:` + YAML pattern documents intent clearly even without a runner. Removing them would erase scenario context from the specs. The blocks are harmless once the runner is gone.
