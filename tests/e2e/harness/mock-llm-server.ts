import http from 'node:http'

export interface RecordedRequest {
  messages: Array<{ role: string; content: string }>
  model: string
  stream: boolean
  timestamp: number
}

export class MockLLMServer {
  private server: http.Server | null = null
  private _port: number
  private _requests: RecordedRequest[] = []
  private responseText: string

  constructor(opts?: { port?: number; responseText?: string }) {
    this._port = opts?.port ?? 0
    this.responseText = opts?.responseText ?? 'I am a mock soul response.'
  }

  get port(): number {
    return this._port
  }

  get url(): string {
    return `http://localhost:${this._port}/v1`
  }

  get requests(): RecordedRequest[] {
    return this._requests
  }

  async start(): Promise<string> {
    return new Promise((resolve, reject) => {
      this.server = http.createServer((req, res) => {
        if (req.method === 'POST' && req.url === '/v1/chat/completions') {
          this.handleChatCompletion(req, res)
        } else {
          res.writeHead(404)
          res.end()
        }
      })

      this.server.on('error', reject)
      this.server.listen(this._port, () => {
        const addr = this.server!.address()
        if (typeof addr === 'object' && addr) {
          this._port = addr.port
        }
        resolve(this.url)
      })
    })
  }

  async stop(): Promise<void> {
    return new Promise((resolve) => {
      if (!this.server) {
        resolve()
        return
      }
      this.server.close(() => resolve())
    })
  }

  private handleChatCompletion(req: http.IncomingMessage, res: http.ServerResponse) {
    let body = ''
    req.on('data', (chunk: Buffer) => { body += chunk.toString() })
    req.on('end', () => {
      const parsed = JSON.parse(body)

      this._requests.push({
        messages: parsed.messages,
        model: parsed.model,
        stream: parsed.stream ?? false,
        timestamp: Date.now(),
      })

      if (parsed.stream) {
        this.streamResponse(res)
      } else {
        this.jsonResponse(res)
      }
    })
  }

  private streamResponse(res: http.ServerResponse) {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    })

    const words = this.responseText.split(' ')
    let i = 0

    const sendChunk = () => {
      if (i < words.length) {
        const content = (i === 0 ? '' : ' ') + words[i]
        const chunk = {
          id: `chatcmpl-mock-${i}`,
          object: 'chat.completion.chunk',
          choices: [{ index: 0, delta: { content }, finish_reason: null }],
        }
        res.write(`data: ${JSON.stringify(chunk)}\n\n`)
        i++
        setTimeout(sendChunk, 10)
      } else {
        const done = {
          id: `chatcmpl-mock-done`,
          object: 'chat.completion.chunk',
          choices: [{ index: 0, delta: {}, finish_reason: 'stop' }],
        }
        res.write(`data: ${JSON.stringify(done)}\n\n`)
        res.write('data: [DONE]\n\n')
        res.end()
      }
    }

    sendChunk()
  }

  private jsonResponse(res: http.ServerResponse) {
    const response = {
      id: 'chatcmpl-mock',
      object: 'chat.completion',
      choices: [{
        index: 0,
        message: { role: 'assistant', content: this.responseText },
        finish_reason: 'stop',
      }],
    }
    res.writeHead(200, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify(response))
  }
}
