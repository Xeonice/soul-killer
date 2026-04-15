import http from 'node:http'
import fs from 'node:fs'
import crypto from 'node:crypto'
import { zipSync, strToU8 } from 'fflate'

/**
 * Local HTTP server for E2E tests of `skill install` / `skill catalog`.
 *
 * Exposes two routes:
 *   GET /examples/catalog.json           → in-memory catalog
 *   GET /examples/skills/<slug>.skill    → in-memory .skill archive bytes
 *
 * Callers register skills via addSkill(); the server auto-computes sha256
 * and size for each one so CLI validation paths stay exercised.
 */
export interface MockSkillOptions {
  slug: string
  displayName?: string
  description?: string
  engineVersion?: number
  /** Skill version string embedded in catalog and soulkiller.json. Default '1.0.0'. */
  version?: string
}

interface StoredSkill {
  slug: string
  bytes: Uint8Array
  sha256: string
  engineVersion: number
  version: string
  displayName: string
  description: string
}

export class MockCatalogServer {
  private server: http.Server | null = null
  private _port = 0
  private skills: StoredSkill[] = []

  /** Add a skill to the catalog. Returns the sha256 for assertions if needed. */
  addSkill(opts: MockSkillOptions): string {
    const engineVersion = opts.engineVersion ?? 2
    const version = opts.version ?? '1.0.0'
    const bytes = zipSync({
      [`${opts.slug}/SKILL.md`]: strToU8(`---\nname: ${opts.slug}\ndescription: ${opts.description ?? ''}\n---\nbody`),
      [`${opts.slug}/soulkiller.json`]: strToU8(JSON.stringify({
        engine_version: engineVersion,
        soulkiller_version: '0.4.0',
        skill_id: opts.slug,
        version,
      })),
    })
    const sha256 = crypto.createHash('sha256').update(bytes).digest('hex')
    // Replace if same slug exists (allows bumping versions in tests)
    this.skills = this.skills.filter((s) => s.slug !== opts.slug)
    this.skills.push({
      slug: opts.slug,
      bytes,
      sha256,
      engineVersion,
      version,
      displayName: opts.displayName ?? opts.slug,
      description: opts.description ?? '',
    })
    return sha256
  }

  async start(): Promise<string> {
    return new Promise((resolve, reject) => {
      this.server = http.createServer((req, res) => this.handle(req, res))
      this.server.on('error', reject)
      this.server.listen(0, () => {
        const addr = this.server!.address()
        if (typeof addr === 'object' && addr) this._port = addr.port
        resolve(this.catalogUrl)
      })
    })
  }

  async stop(): Promise<void> {
    return new Promise((resolve) => {
      if (!this.server) return resolve()
      this.server.close(() => resolve())
    })
  }

  get baseUrl(): string {
    return `http://127.0.0.1:${this._port}`
  }

  get catalogUrl(): string {
    return `${this.baseUrl}/examples/catalog.json`
  }

  private handle(req: http.IncomingMessage, res: http.ServerResponse): void {
    const url = req.url ?? ''

    if (url === '/examples/catalog.json') {
      const body = JSON.stringify({
        version: 1,
        updated_at: new Date().toISOString(),
        soulkiller_version_min: '0.4.0',
        skills: this.skills.map((s) => ({
          slug: s.slug,
          display_name: s.displayName,
          description: s.description,
          version: s.version,
          engine_version: s.engineVersion,
          size_bytes: s.bytes.byteLength,
          sha256: s.sha256,
          url: `/examples/skills/${s.slug}.skill`,
          soulkiller_version_min: '0.4.0',
        })),
      })
      res.writeHead(200, {
        'Content-Type': 'application/json',
        'Content-Length': String(Buffer.byteLength(body)),
      })
      res.end(body)
      return
    }

    const m = url.match(/^\/examples\/skills\/([\w-]+)\.skill$/)
    if (m) {
      const skill = this.skills.find((s) => s.slug === m[1])
      if (!skill) {
        res.writeHead(404)
        res.end('not found')
        return
      }
      res.writeHead(200, {
        'Content-Type': 'application/octet-stream',
        'Content-Length': String(skill.bytes.byteLength),
      })
      res.end(Buffer.from(skill.bytes))
      return
    }

    res.writeHead(404)
    res.end('not found')
  }

  /** Write a skill's bytes to a local path — useful for `install <path>` tests. */
  writeSkillToPath(slug: string, destPath: string): void {
    const skill = this.skills.find((s) => s.slug === slug)
    if (!skill) throw new Error(`unknown skill: ${slug}`)
    fs.writeFileSync(destPath, skill.bytes)
  }
}
