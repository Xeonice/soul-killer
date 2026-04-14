import fs from 'node:fs'
import path from 'node:path'
import { extractZip } from '../../infra/archive/index.js'
import { CURRENT_ENGINE_VERSION } from '../../export/spec/skill-template.js'

export class EngineIncompatibleError extends Error {
  constructor(
    public readonly required: number,
    public readonly supported: number,
    public readonly slug?: string,
  ) {
    const prefix = slug ? `${slug} requires` : 'skill requires'
    super(
      `${prefix} engine_version ≥ ${required}; current soulkiller supports ≤ ${supported}. ` +
        `Run /upgrade (REPL) or soulkiller --update (CLI) first.`,
    )
    this.name = 'EngineIncompatibleError'
  }
}

export interface ExtractedSkill {
  /** Working directory with unpacked (and stripped) skill contents */
  stagingDir: string
  /** Parsed soulkiller.json (if present) */
  soulkillerJson: Record<string, unknown> | null
  /** Engine version from soulkiller.json, or null if absent */
  engineVersion: number | null
}

/**
 * Unzip the .skill archive to a fresh staging directory, auto-stripping the
 * single root wrapper directory if present, and return the parsed metadata.
 * Does not perform engine-compat check — call checkEngineCompat separately.
 */
export function extractSkillArchive(bytes: Uint8Array, tmpDir: string): ExtractedSkill {
  fs.mkdirSync(tmpDir, { recursive: true })
  extractZip(bytes, tmpDir, { stripSingleRootDir: true })

  const jsonPath = path.join(tmpDir, 'soulkiller.json')
  let soulkillerJson: Record<string, unknown> | null = null
  let engineVersion: number | null = null
  if (fs.existsSync(jsonPath)) {
    try {
      soulkillerJson = JSON.parse(fs.readFileSync(jsonPath, 'utf8'))
      const ev = soulkillerJson?.engine_version
      if (typeof ev === 'number') engineVersion = ev
    } catch {
      // Malformed JSON — leave null; caller can decide whether to continue
    }
  }

  return { stagingDir: tmpDir, soulkillerJson, engineVersion }
}

/**
 * Throws EngineIncompatibleError if the skill needs a newer engine than
 * this binary supports.
 */
export function checkEngineCompat(engineVersion: number | null, slug?: string): void {
  if (engineVersion === null) return
  if (engineVersion > CURRENT_ENGINE_VERSION) {
    throw new EngineIncompatibleError(engineVersion, CURRENT_ENGINE_VERSION, slug)
  }
}

export { CURRENT_ENGINE_VERSION }
