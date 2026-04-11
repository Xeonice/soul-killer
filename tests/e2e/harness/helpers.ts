// Shared constants and helpers for E2E tests

// Prompt pattern for both void and loaded modes
export const PROMPT_RE = /soul:\/\/\S+.*>/

// CI-friendly timeout constants
// In CI, PTY I/O and ink rendering can be 3-5x slower than local due to
// resource contention, virtualized I/O, and lack of GPU-accelerated TTY.
// These values are deliberately generous — a slow pass beats a flaky fail.
export const SOUL_LOAD_TIMEOUT = 20000
export const WIZARD_STEP_TIMEOUT = 10000
export const INSTANT_TIMEOUT = 8000

// Set E2E_DEBUG=1 to see detailed timeline for each test
export const DEBUG = !!process.env.E2E_DEBUG
