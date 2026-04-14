import path from 'node:path'

const PROJECT_ROOT = path.resolve(import.meta.dirname, '..', '..', '..')
const ENTRY = path.join(PROJECT_ROOT, 'src', 'index.tsx')

export interface SpawnCliOptions {
  args: string[]
  /** Homedir override — required for isolation from real ~/.soulkiller/ */
  homeDir: string
  env?: Record<string, string | undefined>
  /** Override current working directory (e.g., for --scope project tests). */
  cwd?: string
  timeoutMs?: number
}

export interface SpawnCliResult {
  stdout: string
  stderr: string
  exitCode: number
}

/**
 * Run a soulkiller CLI subcommand (e.g. `skill install`, `skill catalog`) in a
 * child `bun` process and capture stdout/stderr. Uses `Bun.spawn` (not PTY) —
 * subcommands exit after running, so we don't need an interactive terminal.
 *
 * This is deliberately a thin wrapper: give it args and a HOME dir, get back
 * a structured result. No waitFor loops, no event emitters.
 */
export async function spawnCli(opts: SpawnCliOptions): Promise<SpawnCliResult> {
  const env: Record<string, string> = {
    ...(process.env as Record<string, string>),
    ...(opts.env as Record<string, string> | undefined ?? {}),
    HOME: opts.homeDir,
  }
  delete env.CI
  delete env.GITHUB_ACTIONS

  const proc = Bun.spawn(['bun', ENTRY, ...opts.args], {
    cwd: opts.cwd ?? PROJECT_ROOT,
    env,
    stdin: 'ignore',
    stdout: 'pipe',
    stderr: 'pipe',
  })

  const timeoutMs = opts.timeoutMs ?? 30000
  let killed = false
  const timer = setTimeout(() => {
    killed = true
    try { proc.kill() } catch { /* ignore */ }
  }, timeoutMs)

  const [stdout, stderr, exitCode] = await Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
    proc.exited,
  ])
  clearTimeout(timer)

  if (killed) {
    throw new Error(`spawnCli timed out after ${timeoutMs}ms; args=${opts.args.join(' ')}`)
  }

  return { stdout, stderr, exitCode }
}
