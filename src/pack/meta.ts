export const FORMAT_VERSION = '1.0'
export const SUPPORTED_MAJOR = 1

export type PackType = 'soul' | 'world'

export interface PackMeta {
  format_version: string
  type: PackType
  name: string
  display_name: string
  packed_at: string
  soulkiller_version: string
  includes_worlds: string[]
  checksum: string
}

export function createMeta(
  type: PackType,
  name: string,
  displayName: string,
  includesWorlds: string[] = [],
): PackMeta {
  return {
    format_version: FORMAT_VERSION,
    type,
    name,
    display_name: displayName,
    packed_at: new Date().toISOString(),
    soulkiller_version: '0.1.0',
    includes_worlds: includesWorlds,
    checksum: '',
  }
}

export function parseMeta(raw: string): PackMeta {
  const parsed = JSON.parse(raw) as Record<string, unknown>

  if (!parsed.format_version || !parsed.type || !parsed.name) {
    throw new Error('Invalid pack-meta.json: missing required fields')
  }

  return {
    format_version: String(parsed.format_version),
    type: parsed.type as PackType,
    name: String(parsed.name),
    display_name: String(parsed.display_name ?? parsed.name),
    packed_at: String(parsed.packed_at ?? ''),
    soulkiller_version: String(parsed.soulkiller_version ?? 'unknown'),
    includes_worlds: Array.isArray(parsed.includes_worlds) ? parsed.includes_worlds.map(String) : [],
    checksum: String(parsed.checksum ?? ''),
  }
}

export function validateVersion(meta: PackMeta): { ok: boolean; error?: string } {
  const major = parseInt(meta.format_version.split('.')[0] ?? '0', 10)
  if (isNaN(major) || major > SUPPORTED_MAJOR) {
    return {
      ok: false,
      error: `Unsupported pack format version ${meta.format_version} (supported: ${SUPPORTED_MAJOR}.x)`,
    }
  }
  return { ok: true }
}
