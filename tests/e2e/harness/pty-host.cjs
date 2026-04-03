/**
 * PTY host process — runs outside vitest's module system.
 * Communicates with the test process via IPC (process.send/process.on).
 *
 * Protocol:
 *   parent → child: { type: 'write', data: string }
 *   child → parent: { type: 'data', data: string }
 *   child → parent: { type: 'exit', exitCode: number }
 */
const { spawn } = require('node-pty')
const path = require('path')

const args = JSON.parse(process.argv[2])
const projectRoot = args.projectRoot
const homeDir = args.homeDir
const mockServerUrl = args.mockServerUrl
const cols = args.cols || 120
const rows = args.rows || 40

const env = { ...process.env }
env.HOME = homeDir
env.TERM = 'xterm-256color'
env.COLORTERM = 'truecolor'
env.SOULKILLER_SEED = '42'
if (mockServerUrl) {
  env.SOULKILLER_API_URL = mockServerUrl
}

const tsxCli = path.join(projectRoot, 'node_modules', 'tsx', 'dist', 'cli.mjs')
const entryPoint = path.join(projectRoot, 'src', 'index.tsx')

const pty = spawn(process.execPath, [tsxCli, entryPoint], {
  name: 'xterm-256color',
  cols,
  rows,
  cwd: projectRoot,
  env,
})

pty.onData((data) => {
  process.send({ type: 'data', data })
})

pty.onExit(({ exitCode }) => {
  process.send({ type: 'exit', exitCode })
  setTimeout(() => process.exit(0), 100)
})

process.on('message', (msg) => {
  if (msg.type === 'write') {
    pty.write(msg.data)
  } else if (msg.type === 'write-chars') {
    // Write character by character with small delays for ink compatibility
    const chars = msg.data.split('')
    let i = 0
    const next = () => {
      if (i < chars.length) {
        pty.write(chars[i])
        i++
        setTimeout(next, 10)
      }
    }
    next()
  } else if (msg.type === 'kill') {
    pty.kill()
  } else if (msg.type === 'resize') {
    pty.resize(msg.cols, msg.rows)
  }
})

process.send({ type: 'ready' })
