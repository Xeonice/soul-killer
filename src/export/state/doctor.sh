#!/bin/sh
# Soulkiller skill runtime doctor — POSIX sh, zero dependencies.
#
# Checks platform + bun presence/version, emits structured KEY: value lines
# on stdout for the LLM to parse. Never modifies anything.
#
# Exit codes:
#   0  STATUS: OK
#   1  STATUS: BUN_MISSING           (bootstrap needed)
#   2  STATUS: PLATFORM_UNSUPPORTED / PLATFORM_UNKNOWN
#   3  STATUS: BUN_OUTDATED          (upgrade needed)

set -u

# Minimum bun version required by runtime/lib/*.ts.
# Keep this in sync with the version the state command modules are tested against.
MIN_BUN_MAJOR=1
MIN_BUN_MINOR=1
MIN_BUN_PATCH=0

# Installation target — isolated from any system-wide bun the user may have.
INSTALL_DIR="$HOME/.soulkiller-runtime"
BUN_BIN="$INSTALL_DIR/bin/bun"

# ---------------------------------------------------------------------------
# Platform detection
# ---------------------------------------------------------------------------
detect_platform() {
    uname_s=$(uname -s 2>/dev/null || echo unknown)
    uname_m=$(uname -m 2>/dev/null || echo unknown)
    case "$uname_s" in
        Darwin)
            printf 'darwin-%s' "$uname_m"
            ;;
        Linux)
            if [ -r /proc/version ] && grep -qi microsoft /proc/version 2>/dev/null; then
                printf 'linux-wsl-%s' "$uname_m"
            else
                printf 'linux-%s' "$uname_m"
            fi
            ;;
        MINGW* | MSYS* | CYGWIN*)
            printf 'windows-native'
            ;;
        *)
            printf 'unknown-%s' "$uname_s"
            ;;
    esac
}

PLATFORM=$(detect_platform)

# ---------------------------------------------------------------------------
# Platform gate
# ---------------------------------------------------------------------------
case "$PLATFORM" in
    windows-native)
        printf 'STATUS: PLATFORM_UNSUPPORTED\n'
        printf 'PLATFORM: %s\n' "$PLATFORM"
        printf 'REASON: Windows native shell is not supported. Please use WSL.\n'
        printf 'WSL_DOCS: https://learn.microsoft.com/windows/wsl/install\n'
        exit 2
        ;;
    unknown-*)
        printf 'STATUS: PLATFORM_UNKNOWN\n'
        printf 'PLATFORM: %s\n' "$PLATFORM"
        printf 'REASON: unknown platform, cannot bootstrap runtime automatically\n'
        exit 2
        ;;
esac

# ---------------------------------------------------------------------------
# Bun presence check
# ---------------------------------------------------------------------------
emit_bun_missing() {
    reason=${1:-"bun runtime not installed"}
    printf 'STATUS: BUN_MISSING\n'
    printf 'PLATFORM: %s\n' "$PLATFORM"
    printf 'REASON: %s\n' "$reason"
    printf 'INSTALL_DIR: %s\n' "$INSTALL_DIR"
    printf 'INSTALL_CMD_UNIX: curl -fsSL https://bun.sh/install | BUN_INSTALL=%s bash\n' "$INSTALL_DIR"
    printf 'BUN_DOCS: https://bun.sh/docs/installation\n'
    printf 'UNINSTALL: rm -rf %s\n' "$INSTALL_DIR"
    printf 'SIZE_ESTIMATE: ~90MB\n'
}

if [ ! -x "$BUN_BIN" ]; then
    emit_bun_missing "bun runtime not installed at $BUN_BIN"
    exit 1
fi

# ---------------------------------------------------------------------------
# Bun version probe
# ---------------------------------------------------------------------------
bun_version_raw=$("$BUN_BIN" --version 2>/dev/null || printf '')
if [ -z "$bun_version_raw" ]; then
    emit_bun_missing "bun binary at $BUN_BIN does not respond to --version"
    exit 1
fi

# Parse semver (strip any -canary / +build tags)
bun_core=${bun_version_raw%%-*}
bun_core=${bun_core%%+*}
bun_major=$(printf '%s' "$bun_core" | cut -d. -f1)
bun_minor=$(printf '%s' "$bun_core" | cut -d. -f2)
bun_patch=$(printf '%s' "$bun_core" | cut -d. -f3)

# Integer guard: fall back to 0 if any component isn't a plain integer
case "$bun_major" in '' | *[!0-9]*) bun_major=0 ;; esac
case "$bun_minor" in '' | *[!0-9]*) bun_minor=0 ;; esac
case "$bun_patch" in '' | *[!0-9]*) bun_patch=0 ;; esac

outdated=0
if [ "$bun_major" -lt "$MIN_BUN_MAJOR" ]; then
    outdated=1
elif [ "$bun_major" -eq "$MIN_BUN_MAJOR" ] && [ "$bun_minor" -lt "$MIN_BUN_MINOR" ]; then
    outdated=1
elif [ "$bun_major" -eq "$MIN_BUN_MAJOR" ] && [ "$bun_minor" -eq "$MIN_BUN_MINOR" ] && [ "$bun_patch" -lt "$MIN_BUN_PATCH" ]; then
    outdated=1
fi

if [ "$outdated" -eq 1 ]; then
    printf 'STATUS: BUN_OUTDATED\n'
    printf 'PLATFORM: %s\n' "$PLATFORM"
    printf 'BUN_VERSION: %s\n' "$bun_version_raw"
    printf 'BUN_PATH: %s\n' "$BUN_BIN"
    printf 'MIN_VERSION: %d.%d.%d\n' "$MIN_BUN_MAJOR" "$MIN_BUN_MINOR" "$MIN_BUN_PATCH"
    printf 'UPGRADE_CMD_UNIX: curl -fsSL https://bun.sh/install | BUN_INSTALL=%s bash\n' "$INSTALL_DIR"
    printf 'BUN_DOCS: https://bun.sh/docs/installation\n'
    exit 3
fi

# ---------------------------------------------------------------------------
# OK
# ---------------------------------------------------------------------------
printf 'STATUS: OK\n'
printf 'PLATFORM: %s\n' "$PLATFORM"
printf 'BUN_VERSION: %s\n' "$bun_version_raw"
printf 'BUN_PATH: %s\n' "$BUN_BIN"
printf 'INSTALL_DIR: %s\n' "$INSTALL_DIR"
exit 0
