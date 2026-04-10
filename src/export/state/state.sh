#!/bin/bash
# Soulkiller skill runtime state CLI wrapper.
#
# Sole LLM-facing command. Hides bun entirely behind a bash front-end:
#   - `state doctor` → delegates directly to doctor.sh (no bun needed)
#   - anything else   → requires bun at $HOME/.soulkiller-runtime/bin/bun,
#                       then exec's bun to run runtime/lib/main.ts with the
#                       original argv intact
#
# Environment exported to bun:
#   SKILL_ROOT — absolute path to the directory containing runtime/
#
# This script lives at <skill>/runtime/bin/state. All paths are derived from
# its own location — no install step or environment configuration required.

set -euo pipefail

# Resolve absolute paths by walking up from this script.
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
RUNTIME_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
SKILL_ROOT="$(cd "$RUNTIME_DIR/.." && pwd)"
DOCTOR_SH="$SCRIPT_DIR/doctor.sh"
MAIN_TS="$RUNTIME_DIR/lib/main.ts"
BUN_BIN="$HOME/.soulkiller-runtime/bin/bun"

# `state doctor` short-circuits bun — doctor.sh is pure POSIX sh
if [ "${1:-}" = "doctor" ]; then
    exec sh "$DOCTOR_SH"
fi

# All other subcommands need bun. If it's missing, print doctor output to
# stderr so the caller (LLM) can see exactly what to do, then exit non-zero.
if [ ! -x "$BUN_BIN" ]; then
    sh "$DOCTOR_SH" >&2
    exit 1
fi

# Verify main.ts is present — defensive check against a malformed skill archive
if [ ! -f "$MAIN_TS" ]; then
    printf 'error: runtime/lib/main.ts not found at %s\n' "$MAIN_TS" >&2
    printf 'the skill archive may be incomplete or corrupted\n' >&2
    exit 1
fi

export SKILL_ROOT
exec "$BUN_BIN" "$MAIN_TS" "$@"
