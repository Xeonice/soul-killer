import { fork, type ChildProcess } from 'node:child_process'
import path from 'node:path'
import stripAnsi from 'strip-ansi'
import { EventEmitter } from 'node:events'

const PROJECT_ROOT = path.resolve(import.meta.dirname, '..', '..', '..')
const PTY_HOST = path.join(import.meta.dirname, 'pty-host.cjs')

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
  type: 'send' | 'send-key' | 'waitFor-start' | 'waitFor-match' | 'waitFor-timeout' | 'pty-data' | 'exit'
  detail: string
}

export interface TestTerminalOptions {
  homeDir: string
  mockServerUrl?: string
  cols?: number
  rows?: number
  debug?: boolean
}

export class TestTerminal {
  private child: ChildProcess
  private rawBuffer = ''
  private cursor = 0
  private exitPromise: Promise<number>
  private _exitCode: number | null = null
  private emitter = new EventEmitter()
  private debug: boolean
  private timeline: TimelineEntry[] = []
  private startTime: number

  constructor(opts: TestTerminalOptions) {
    this.debug = opts.debug ?? !!process.env.E2E_DEBUG
    this.startTime = Date.now()

    const args = JSON.stringify({
      projectRoot: PROJECT_ROOT,
      homeDir: opts.homeDir,
      mockServerUrl: opts.mockServerUrl,
      cols: opts.cols ?? 120,
      rows: opts.rows ?? 40,
    })

    this.child = fork(PTY_HOST, [args], {
      stdio: ['pipe', 'pipe', 'pipe', 'ipc'],
    })

    this.child.on('message', (msg: { type: string; data?: string; exitCode?: number }) => {
      if (msg.type === 'data') {
        this.rawBuffer += msg.data!
        if (this.debug) {
          const clean = stripAnsi(msg.data!).replace(/\s+/g, ' ').trim()
          if (clean) {
            this.log('pty-data', clean.slice(0, 120))
          }
        }
        this.emitter.emit('data')
      } else if (msg.type === 'exit') {
        this._exitCode = msg.exitCode ?? 0
        this.log('exit', `code=${this._exitCode}`)
        this.emitter.emit('exit', this._exitCode)
      }
    })

    this.exitPromise = new Promise<number>((resolve) => {
      this.emitter.on('exit', resolve)
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
    const typeStyles: Record<string, string> = {
      'send': '>>>',
      'send-key': ' >>',
      'waitFor-start': ' ? ',
      'waitFor-match': ' OK',
      'waitFor-timeout': ' !!',
      'pty-data': ' <<',
      'exit': '===',
    }
    return this.timeline.map((e) => {
      const prefix = typeStyles[e.type] ?? '   '
      const ts = String(e.ts).padStart(6)
      return `${ts}ms ${prefix}  ${e.detail}`
    }).join('\n')
  }

  printTimeline(): void {
    console.log('\n┌─── E2E Timeline ────────────────────────────────────────┐')
    console.log(this.getTimeline())
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

    this.log('waitFor-start', `${regex}  (since: ${since}, timeout: ${timeout}ms)`)

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
        this.log('waitFor-match', `"${immediate.matched.slice(0, 60)}"  (${immediate.elapsed}ms)`)
        resolve(immediate)
        return
      }

      const onData = () => {
        const result = check()
        if (result) {
          cleanup()
          this.log('waitFor-match', `"${result.matched.slice(0, 60)}"  (${result.elapsed}ms)`)
          resolve(result)
        }
      }

      const timer = setTimeout(() => {
        cleanup()
        const text = strip ? stripAnsi(this.rawBuffer) : this.rawBuffer
        this.log('waitFor-timeout', `${regex}  after ${Date.now() - start}ms`)
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
    this.child.send({ type: 'write-chars', data: input + '\r' })
  }

  sendKey(key: string): void {
    const raw = KEY_MAP[key] ?? key
    const label = KEY_LABELS[raw] ?? key
    this.log('send-key', label)
    this.child.send({ type: 'write', data: raw })
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
    this.child.send({ type: 'kill' })
    setTimeout(() => {
      if (!this.child.killed) {
        this.child.kill()
      }
    }, 1000)
  }

  async waitForExit(timeout = 10000): Promise<number> {
    const timer = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error(`Process did not exit within ${timeout}ms`)), timeout)
    )
    return Promise.race([this.exitPromise, timer])
  }
}
