import http from 'node:http'
import fs from 'node:fs'
import path from 'node:path'
import { WebSocketServer } from 'ws'
import { spawn } from 'node-pty'

const PORT = 3456
const HARNESS_DIR = path.dirname(new URL(import.meta.url).pathname)

export function startHarness(command: string, args: string[] = []): Promise<{
  url: string
  close: () => void
}> {
  return new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      const filePath = path.join(HARNESS_DIR, 'terminal.html')
      if (req.url === '/' || req.url === '/index.html') {
        res.writeHead(200, { 'Content-Type': 'text/html' })
        res.end(fs.readFileSync(filePath))
      } else {
        res.writeHead(404)
        res.end()
      }
    })

    const wss = new WebSocketServer({ server, path: '/ws' })

    wss.on('connection', (ws) => {
      const pty = spawn(command, args, {
        name: 'xterm-256color',
        cols: 120,
        rows: 40,
        env: {
          ...process.env,
          TERM: 'xterm-256color',
          COLORTERM: 'truecolor',
        },
      })

      pty.onData((data) => {
        ws.send(data)
      })

      ws.on('message', (data) => {
        pty.write(data.toString())
      })

      ws.on('close', () => {
        pty.kill()
      })

      pty.onExit(() => {
        ws.close()
      })
    })

    server.listen(PORT, () => {
      resolve({
        url: `http://localhost:${PORT}`,
        close: () => {
          wss.close()
          server.close()
        },
      })
    })
  })
}
