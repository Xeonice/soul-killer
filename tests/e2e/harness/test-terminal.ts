import path from 'node:path'
import stripAnsi from 'strip-ansi'
import { EventEmitter } from 'node:events'

const PROJECT_ROOT = path.resolve(import.meta.dirname, '..', '..', '..')

export class WaitForTimeout extends Error {
  constructor(pattern: RegExp | string, elapsed: number, buffer: string) {
    const preview = buffer.slice(-500)
    super(
      `waitFor timed out after ${elapsed}ms\n` +
      `  pattern: ${pattern}\n` +
      `  buffer tail:\n` +
      `  ────────────\n` +
      `  ${preview}\n` +
      `  ────────────`
    )
    this.name = 'WaitForTimeout'
  }
}

export interface WaitForOptions {
  timeout?: number
  strip?: boolean
  since?: 'start' | 'last'
}

export interface WaitForResult {
  matched: string
  fullBuffer: string
  elapsed: number
}

const KEY_MAP: Record<string, string> = {
  tab: '\t',
  escape: '\x1b',
  up: '\x1b[A',
  down: '\x1b[B',
  right: '\x1b[C',
  left: '\x1b[D',
  enter: '\r',
  backspace: '\x7f',
}

const KEY_LABELS: Record<string, string> = {
  '\t': '<Tab>',
  '\x1b': '<Esc>',
  '\x1b[A': '<Up>',
  '\x1b[B': '<Down>',
  '\x1b[C': '<Right>',
  '\x1b[D': '<Left>',
  '\r': '<Enter>',
  '\x7f': '<Backspace>',
}

interface TimelineEntry {
  ts: number
  type: 'send' | 'send-key' | 'waitFor-start' | 'waitFor-match' | 'waitFor-timeout' | 'pty-data' | 'screen' | 'exit'
  detail: string
}

export interface TestTerminalOptions {
  homeDir: string
  mockServerUrl?: string
  cols?: number
  rows?: number
  debug?: boolean
  /** Label shown at the top of timeline output (e.g. test file + scenario name) */
  label?: string
}

export class TestTerminal {
  private proc: ReturnType<typeof Bun.spawn>
  private rawBuffer = ''
  private cursor = 0
  private _exitCode: number | null = null
  private _killed = false
  private emitter = new EventEmitter()
  private debug: boolean
  private label: string
  private timeline: TimelineEntry[] = []
  private startTime: number

  constructor(opts: TestTerminalOptions) {
    this.debug = opts.debug ?? !!process.env.E2E_DEBUG
    this.label = opts.label ?? ''
    this.startTime = Date.now()

    const cols = opts.cols ?? 120
    const rows = opts.rows ?? 40

    const env: Record<string, string> = { ...process.env as Record<string, string> }
    env.HOME = opts.homeDir
    env.TERM = 'xterm-256color'
    env.COLORTERM = 'truecolor'
    env.SOULKILLER_SEED = '42'
    // ink v6 detects CI=true and suppresses dynamic rendering output,
    // but the PTY child runs an interactive CLI that needs normal TTY mode.
    delete env.CI
    delete env.GITHUB_ACTIONS
    if (opts.mockServerUrl) {
      env.SOULKILLER_API_URL = opts.mockServerUrl
    }

    const entryPoint = path.join(PROJECT_ROOT, 'src', 'index.tsx')

    this.proc = Bun.spawn(['bun', entryPoint], {
      cwd: PROJECT_ROOT,
      env,
      terminal: {
        cols,
        rows,
        data: (_terminal, data) => {
          const text = new TextDecoder().decode(data)
          this.rawBuffer += text
          if (this.debug) {
            const lines = stripAnsi(text).split('\n').map((l) => l.trim()).filter(Boolean)
            for (const line of lines) {
              if (/^[│┌┐└┘├┤┬┴┼─╴╶╵╷┃┏┓┗┛┣┫┳┻╋━═║╔╗╚╝╠╣╦╩╬\s]+$/.test(line)) continue
              if (/^\(?\d+ entries/.test(line)) continue
              this.log('pty-data', line.slice(0, 150))
            }
          }
          this.emitter.emit('data')
        },
        exit: (_terminal, exitCode) => {
          this.log('exit', `terminal closed, pty code=${exitCode}`)
        },
      },
    })

    // Use proc.exited for the actual process exit code (terminal.exit may
    // report a different code on Linux when the PTY closes before the process)
    this.proc.exited.then((code) => {
      this._exitCode = code
      this.log('exit', `process exited, code=${code}`)
      this.emitter.emit('exit', code)
    })
  }

  private log(type: TimelineEntry['type'], detail: string) {
    const elapsed = Date.now() - this.startTime
    this.timeline.push({ ts: elapsed, type, detail })
  }

  get exitCode(): number | null {
    return this._exitCode
  }

  getBuffer(strip = true): string {
    return strip ? stripAnsi(this.rawBuffer) : this.rawBuffer
  }

  getTimeline(): string {
    const labels: Record<string, string> = {
      'send':            'INPUT  ',
      'send-key':        'KEY    ',
      'waitFor-start':   'WAIT   ',
      'waitFor-match':   'MATCH  ',
      'waitFor-timeout': 'TIMEOUT',
      'pty-data':        'TTY    ',
      'screen':          'SCREEN ',
      'exit':            'EXIT   ',
    }
    return this.timeline.map((e) => {
      const label = labels[e.type] ?? '       '
      const ts = String(e.ts).padStart(6)
      if (e.type === 'screen') {
        const indented = e.detail.split('\n').map((l) => `          ${l}`).join('\n')
        return `${ts}ms ${label}\n${indented}`
      }
      return `${ts}ms ${label}  ${e.detail}`
    }).join('\n')
  }

  printTimeline(): void {
    const title = this.label ? `E2E: ${this.label}` : 'E2E Timeline'
    const pad = Math.max(0, 55 - title.length)
    console.log(`\n┌─── ${title} ${'─'.repeat(pad)}┐`)
    console.log(this.getTimeline())
    console.log('└─────────────────────────────────────────────────────────┘\n')
  }

  getScreen(lastN = 30): string {
    const text = stripAnsi(this.rawBuffer)
    const lines = text.split('\n').filter((l) => l.trim())
    return lines.slice(-lastN).join('\n')
  }

  printScreen(label?: string): void {
    const header = label ? `Screen: ${label}` : 'Screen'
    console.log(`\n┌─── ${header} ${'─'.repeat(Math.max(0, 50 - header.length))}┐`)
    console.log(this.getScreen())
    console.log('└─────────────────────────────────────────────────────────┘\n')
  }

  // --- Low-level API ---

  async waitFor(
    pattern: RegExp | string,
    opts?: WaitForOptions,
  ): Promise<WaitForResult> {
    const timeout = opts?.timeout ?? 10000
    const strip = opts?.strip ?? true
    const since = opts?.since ?? 'start'
    const regex = typeof pattern === 'string' ? new RegExp(pattern) : pattern
    const start = Date.now()

    this.log('waitFor-start', `waiting for ${regex}  (since: ${since}, timeout: ${timeout}ms)`)

    return new Promise<WaitForResult>((resolve, reject) => {
      const check = () => {
        const raw = this.rawBuffer
        const text = strip ? stripAnsi(raw) : raw
        const searchText = since === 'last' ? text.slice(this.cursor) : text
        const match = regex.exec(searchText)
        if (match) {
          this.cursor = text.length
          return { matched: match[0], fullBuffer: text, elapsed: Date.now() - start }
        }
        return null
      }

      const immediate = check()
      if (immediate) {
        this.log('waitFor-match', `matched "${immediate.matched.slice(0, 60)}"  (${immediate.elapsed}ms)`)
        if (this.debug) this.log('screen', this.getScreen(10))
        resolve(immediate)
        return
      }

      const onData = () => {
        const result = check()
        if (result) {
          cleanup()
          this.log('waitFor-match', `matched "${result.matched.slice(0, 60)}"  (${result.elapsed}ms)`)
          if (this.debug) this.log('screen', this.getScreen(10))
          resolve(result)
        }
      }

      const timer = setTimeout(() => {
        cleanup()
        const text = strip ? stripAnsi(this.rawBuffer) : this.rawBuffer
        this.log('waitFor-timeout', `TIMED OUT on ${regex}  after ${Date.now() - start}ms`)
        if (this.debug) this.log('screen', this.getScreen(15))
        reject(new WaitForTimeout(pattern, Date.now() - start, text))
      }, timeout)

      this.emitter.on('data', onData)

      const cleanup = () => {
        clearTimeout(timer)
        this.emitter.off('data', onData)
      }
    })
  }

  // --- Semantic helpers ---

  async waitForPrompt(opts?: WaitForOptions): Promise<WaitForResult> {
    return this.waitFor(/soul:\/\/\S+.*>/, { since: 'last', ...opts })
  }

  async waitForError(title?: string, opts?: WaitForOptions): Promise<WaitForResult> {
    const pattern = title
      ? new RegExp(title)
      : /ERROR|WARNING|MALFUNCTION/
    return this.waitFor(pattern, { since: 'last', ...opts })
  }

  async waitForStreamEnd(opts?: WaitForOptions): Promise<WaitForResult> {
    return this.waitForPrompt({ timeout: 30000, ...opts })
  }

  // --- High-level API ---

  send(input: string): void {
    this.log('send', `"${input}"`)
    // Write character by character with small delays for ink compatibility
    const chars = (input + '\r').split('')
    let i = 0
    const next = () => {
      if (this._killed || i >= chars.length) return
      this.proc.terminal!.write(chars[i]!)
      i++
      setTimeout(next, 10)
    }
    next()
  }

  sendKey(key: string): void {
    if (this._killed) return
    const raw = KEY_MAP[key] ?? key
    const label = KEY_LABELS[raw] ?? key
    this.log('send-key', label)
    this.proc.terminal!.write(raw)
  }

  async sendAndWait(
    input: string,
    pattern: RegExp | string,
    opts?: WaitForOptions,
  ): Promise<WaitForResult> {
    this.send(input)
    return this.waitFor(pattern, { since: 'last', ...opts })
  }

  async sendCommand(cmd: string, opts?: WaitForOptions): Promise<WaitForResult> {
    this.send(cmd)
    return this.waitForPrompt(opts)
  }

  // --- Lifecycle ---

  kill(): void {
    this._killed = true
    this.proc.kill()
  }

  async waitForExit(timeout = 10000): Promise<number> {
    if (this._exitCode !== null) return this._exitCode
    const timer = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error(`Process did not exit within ${timeout}ms`)), timeout)
    )
    const exitPromise = new Promise<number>((resolve) => {
      this.emitter.once('exit', resolve)
    })
    return Promise.race([exitPromise, timer])
  }
}
