import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import type { SoulChunk, DataAdapter, ChunkTemporal } from './types.js'

export class MarkdownAdapter implements DataAdapter {
  name = 'markdown'

  async *adapt(dirPath: string): AsyncIterable<SoulChunk> {
    const files = await scanMarkdownFiles(dirPath)

    for (const filePath of files) {
      const content = fs.readFileSync(filePath, 'utf-8')
      const stat = fs.statSync(filePath)
      const relativePath = path.relative(dirPath, filePath)
      const topicTag = path.dirname(relativePath).replace(/\//g, '.')
      const temporal = extractTemporal(content, path.basename(filePath), stat.mtime)

      const chunks = splitByHeading(content)

      for (const chunk of chunks) {
        if (!chunk.content.trim()) continue

        yield {
          id: crypto.createHash('sha256').update(`md:${filePath}:${chunk.heading}`).digest('hex').slice(0, 16),
          source: 'markdown',
          content: chunk.heading ? `## ${chunk.heading}\n\n${chunk.content}` : chunk.content,
          timestamp: new Date().toISOString(),
          context: 'work',
          type: inferChunkType(chunk.content),
          metadata: {
            file: relativePath,
            heading: chunk.heading,
            topic: topicTag === '.' ? undefined : topicTag,
          },
          temporal,
        }
      }
    }
  }
}

async function scanMarkdownFiles(dirPath: string): Promise<string[]> {
  const results: string[] = []

  function walk(dir: string) {
    const entries = fs.readdirSync(dir, { withFileTypes: true })
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name)
      if (entry.isDirectory() && !entry.name.startsWith('.') && entry.name !== 'node_modules') {
        walk(fullPath)
      } else if (entry.isFile() && entry.name.endsWith('.md')) {
        results.push(fullPath)
      }
    }
  }

  walk(dirPath)
  return results
}

interface HeadingChunk {
  heading: string
  content: string
}

function splitByHeading(content: string): HeadingChunk[] {
  const lines = content.split('\n')
  const chunks: HeadingChunk[] = []
  let currentHeading = ''
  let currentContent: string[] = []

  for (const line of lines) {
    const headingMatch = line.match(/^#{1,2}\s+(.+)/)
    if (headingMatch) {
      if (currentContent.length > 0) {
        chunks.push({ heading: currentHeading, content: currentContent.join('\n').trim() })
      }
      currentHeading = headingMatch[1]!
      currentContent = []
    } else {
      currentContent.push(line)
    }
  }

  if (currentContent.length > 0) {
    chunks.push({ heading: currentHeading, content: currentContent.join('\n').trim() })
  }

  return chunks
}

/**
 * Extract temporal metadata from markdown file.
 * Priority: frontmatter date → filename date pattern → file mtime.
 */
export function extractTemporal(content: string, filename: string, mtime: Date): ChunkTemporal {
  // 1. Frontmatter date
  const fmDate = parseFrontmatterDate(content)
  if (fmDate) {
    return { date: fmDate, confidence: 'exact' }
  }

  // 2. Filename date pattern: YYYY-MM-DD-*.md or YYYY-MM-*.md
  const fullMatch = filename.match(/^(\d{4}-\d{2}-\d{2})/)
  if (fullMatch) {
    return { date: fullMatch[1]!, confidence: 'exact' }
  }

  const partialMatch = filename.match(/^(\d{4}-\d{2})(?:-[^0-9]|\.md$)/)
  if (partialMatch) {
    return { date: `${partialMatch[1]!}-01`, period: partialMatch[1]!, confidence: 'inferred' }
  }

  // 3. Fallback to mtime
  return { date: mtime.toISOString().slice(0, 10), confidence: 'inferred' }
}

/**
 * Parse YAML frontmatter date field from markdown content.
 * Returns ISO date string (YYYY-MM-DD) or undefined.
 */
export function parseFrontmatterDate(content: string): string | undefined {
  if (!content.startsWith('---')) return undefined

  const endIdx = content.indexOf('---', 3)
  if (endIdx === -1) return undefined

  const frontmatter = content.slice(3, endIdx)
  const dateMatch = frontmatter.match(/^date:\s*['"]?(\d{4}-\d{2}-\d{2})['"]?/m)
  return dateMatch?.[1]
}

function inferChunkType(content: string): SoulChunk['type'] {
  const lower = content.toLowerCase()
  if (lower.includes('我认为') || lower.includes('我觉得') || lower.includes('i think') || lower.includes('i believe')) {
    return 'opinion'
  }
  if (lower.includes('决定') || lower.includes('选择') || lower.includes('decided') || lower.includes('chose')) {
    return 'decision'
  }
  if (lower.includes('反思') || lower.includes('复盘') || lower.includes('lesson')) {
    return 'reflection'
  }
  return 'knowledge'
}
