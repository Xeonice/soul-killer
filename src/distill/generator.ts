import fs from 'node:fs'
import path from 'node:path'
import type { ExtractedFeatures } from './extractor.js'
import type { DistillDimension } from './extractor.js'

/**
 * Generate soul files from extracted features.
 * In delta mode, only writes files for the specified dimensions.
 */
export function generateSoulFiles(
  soulDir: string,
  features: ExtractedFeatures,
  dimensions?: DistillDimension[],
): void {
  const soulPath = path.join(soulDir, 'soul')
  const behaviorsPath = path.join(soulPath, 'behaviors')

  fs.mkdirSync(behaviorsPath, { recursive: true })

  const dims = dimensions ?? ['identity', 'style', 'behaviors']

  // identity.md
  if (dims.includes('identity') && features.identity) {
    fs.writeFileSync(
      path.join(soulPath, 'identity.md'),
      `# Identity\n\n${features.identity}\n`
    )
  }

  // style.md
  if (dims.includes('style') && features.style) {
    fs.writeFileSync(
      path.join(soulPath, 'style.md'),
      `# Style\n\n${features.style}\n`
    )
  }

  // behaviors/*.md
  if (dims.includes('behaviors')) {
    for (const behavior of features.behaviors) {
      fs.writeFileSync(
        path.join(behaviorsPath, `${behavior.name}.md`),
        `${behavior.content}\n`
      )
    }
  }
}

/**
 * Load existing soul files from disk.
 */
export function loadSoulFiles(soulDir: string): {
  identity: string
  style: string
  behaviors: Record<string, string>
} | null {
  const soulPath = path.join(soulDir, 'soul')
  const identityPath = path.join(soulPath, 'identity.md')

  if (!fs.existsSync(identityPath)) return null

  const identity = fs.readFileSync(identityPath, 'utf-8')
  const style = fs.existsSync(path.join(soulPath, 'style.md'))
    ? fs.readFileSync(path.join(soulPath, 'style.md'), 'utf-8')
    : ''

  const behaviors: Record<string, string> = {}
  const behaviorsPath = path.join(soulPath, 'behaviors')
  if (fs.existsSync(behaviorsPath)) {
    for (const file of fs.readdirSync(behaviorsPath)) {
      if (file.endsWith('.md')) {
        const name = file.replace('.md', '')
        behaviors[name] = fs.readFileSync(path.join(behaviorsPath, file), 'utf-8')
      }
    }
  }

  return { identity, style, behaviors }
}
