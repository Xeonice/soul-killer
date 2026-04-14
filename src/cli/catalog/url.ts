/**
 * URL resolution for the skill catalog.
 * Priority: CLI flag > env SOULKILLER_CATALOG_URL > hardcoded default.
 */

export const DEFAULT_CATALOG_URL =
  'https://soulkiller-download.ad546971975.workers.dev/examples/catalog.json'

export function resolveCatalogUrl(flag?: string): string {
  if (flag && flag.trim()) return flag.trim()
  const env = process.env.SOULKILLER_CATALOG_URL
  if (env && env.trim()) return env.trim()
  return DEFAULT_CATALOG_URL
}

/** Resolve a per-entry skill URL against the catalog base URL. */
export function resolveSkillUrl(catalogUrl: string, entryUrl: string): string {
  if (/^https?:\/\//i.test(entryUrl)) return entryUrl
  return new URL(entryUrl, catalogUrl).toString()
}
