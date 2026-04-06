import http from 'node:http'

export interface RecordedRequest {
  messages: Array<{ role: string; content: string }>
  model: string
  stream: boolean
  timestamp: number
}

export interface ToolCallResponse {
  tool_calls: Array<{
    id: string
    type: 'function'
    function: { name: string; arguments: string }
  }>
}

export type MockResponse =
  | { type: 'text'; content: string }
  | { type: 'tool_calls'; tool_calls: ToolCallResponse['tool_calls'] }

export class MockLLMServer {
  private server: http.Server | null = null
  private _port: number
  private _requests: RecordedRequest[] = []
  private responseText: string
  private _responseQueue: MockResponse[] = []

  constructor(opts?: { port?: number; responseText?: string }) {
    this._port = opts?.port ?? 0
    this.responseText = opts?.responseText ?? 'I am a mock soul response.'
  }

  /**
   * Queue a sequence of responses. Each request pops the next response.
   * When queue is empty, falls back to default responseText.
   */
  setResponseQueue(responses: MockResponse[]): void {
    this._responseQueue = [...responses]
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

      // Check response queue first
      const queued = this._responseQueue.shift()

      if (queued) {
        if (queued.type === 'tool_calls') {
          this.toolCallResponse(res, queued.tool_calls, parsed.stream ?? false)
        } else if (parsed.stream) {
          this.streamResponseText(res, queued.content)
        } else {
          this.jsonResponseText(res, queued.content)
        }
      } else if (parsed.stream) {
        this.streamResponse(res)
      } else {
        this.jsonResponse(res)
      }
    })
  }

  private toolCallResponse(
    res: http.ServerResponse,
    toolCalls: ToolCallResponse['tool_calls'],
    stream: boolean,
  ) {
    if (stream) {
      res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      })

      const chunk = {
        id: `chatcmpl-mock-tc`,
        object: 'chat.completion.chunk',
        choices: [{
          index: 0,
          delta: {
            role: 'assistant',
            tool_calls: toolCalls.map((tc, i) => ({
              index: i,
              id: tc.id,
              type: 'function',
              function: { name: tc.function.name, arguments: tc.function.arguments },
            })),
          },
          finish_reason: null,
        }],
      }
      res.write(`data: ${JSON.stringify(chunk)}\n\n`)

      const done = {
        id: `chatcmpl-mock-tc-done`,
        object: 'chat.completion.chunk',
        choices: [{ index: 0, delta: {}, finish_reason: 'tool_calls' }],
      }
      res.write(`data: ${JSON.stringify(done)}\n\n`)
      res.write('data: [DONE]\n\n')
      res.end()
    } else {
      const response = {
        id: 'chatcmpl-mock-tc',
        object: 'chat.completion',
        choices: [{
          index: 0,
          message: {
            role: 'assistant',
            content: null,
            tool_calls: toolCalls,
          },
          finish_reason: 'tool_calls',
        }],
      }
      res.writeHead(200, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify(response))
    }
  }

  private streamResponseText(res: http.ServerResponse, text: string) {
    const saved = this.responseText
    this.responseText = text
    this.streamResponse(res)
    this.responseText = saved
  }

  private jsonResponseText(res: http.ServerResponse, text: string) {
    const response = {
      id: 'chatcmpl-mock',
      object: 'chat.completion',
      choices: [{
        index: 0,
        message: { role: 'assistant', content: text },
        finish_reason: 'stop',
      }],
    }
    res.writeHead(200, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify(response))
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
