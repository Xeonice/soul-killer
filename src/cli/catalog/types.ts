/**
 * Catalog v1 schema — matches Worker endpoint /examples/catalog.json.
 * Kept deliberately permissive at the type level so future additive fields
 * don't break older clients; strict validation happens in client.ts.
 */

export interface SkillEntry {
  slug: string
  display_name: string
  description: string
  version: string
  engine_version: number
  size_bytes: number
  sha256: string
  /** Absolute URL or path relative to the catalog URL */
  url: string
  soulkiller_version_min: string
  characters?: string[]
  tags?: string[]
}

export interface CatalogV1 {
  version: 1
  updated_at: string
  soulkiller_version_min: string
  skills: SkillEntry[]
}
