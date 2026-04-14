import fs from 'node:fs'
import crypto from 'node:crypto'
import type { SkillEntry, CatalogV1 } from '../catalog/types.js'
import { findSkillInCatalog } from '../catalog/client.js'
import { resolveSkillUrl } from '../catalog/url.js'

export interface SourceSlug { kind: 'slug'; slug: string }
export interface SourceUrl { kind: 'url'; url: string }
export interface SourcePath { kind: 'path'; path: string }
export type Source = SourceSlug | SourceUrl | SourcePath

export interface FetchedArchive {
  bytes: Uint8Array
  sha256: string
  entry?: SkillEntry
}

export class DownloadError extends Error {}

/** Classify the user-provided argument into one of three source kinds. */
export function classifySource(arg: string): Source {
  if (/^https?:\/\//i.test(arg)) return { kind: 'url', url: arg }
  if (arg.endsWith('.skill') && fs.existsSync(arg)) return { kind: 'path', path: arg }
  return { kind: 'slug', slug: arg }
}

function sha256Hex(bytes: Uint8Array): string {
  return crypto.createHash('sha256').update(bytes).digest('hex')
}

async function fetchBytes(url: string): Promise<Uint8Array> {
  const res = await fetch(url, { headers: { 'User-Agent': 'soulkiller-install' } })
  if (!res.ok) throw new DownloadError(`HTTP ${res.status} ${res.statusText} — ${url}`)
  const buf = await res.arrayBuffer()
  return new Uint8Array(buf)
}

/**
 * Fetch the archive bytes for a given source.
 *
 * - slug: requires catalog entry; verifies sha256 against catalog.
 * - url:  downloads as-is; no sha256 verification (no trust anchor).
 * - path: reads file; no sha256 verification.
 */
export async function fetchArchive(
  src: Source,
  catalog: CatalogV1 | null,
  catalogUrl: string,
): Promise<FetchedArchive> {
  if (src.kind === 'slug') {
    if (!catalog) throw new DownloadError('catalog required for slug-based install')
    const entry = findSkillInCatalog(catalog, src.slug)
    if (!entry) throw new DownloadError(`unknown slug "${src.slug}" (not in catalog)`)
    const url = resolveSkillUrl(catalogUrl, entry.url)
    const bytes = await fetchBytes(url)
    const gotHash = sha256Hex(bytes)
    if (gotHash !== entry.sha256) {
      throw new DownloadError(
        `checksum mismatch for ${src.slug}: expected ${entry.sha256.slice(0, 16)}…, got ${gotHash.slice(0, 16)}…`,
      )
    }
    return { bytes, sha256: gotHash, entry }
  }

  if (src.kind === 'url') {
    const bytes = await fetchBytes(src.url)
    return { bytes, sha256: sha256Hex(bytes) }
  }

  // kind === 'path'
  const buf = fs.readFileSync(src.path)
  const bytes = new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength)
  return { bytes, sha256: sha256Hex(bytes) }
}
