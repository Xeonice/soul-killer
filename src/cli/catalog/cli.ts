import { fetchCatalog, isCacheStale, CatalogError } from './client.js'

/**
 * `soulkiller skill catalog [--json] [--catalog <url>]`
 * Lists available skills from the remote catalog.
 */
export async function runCatalog(args: string[]): Promise<number> {
  const jsonMode = args.includes('--json')
  const catalogFlagIdx = args.indexOf('--catalog')
  const catalogUrl = catalogFlagIdx >= 0 ? args[catalogFlagIdx + 1] : undefined

  let result
  try {
    result = await fetchCatalog(catalogUrl)
  } catch (err) {
    if (err instanceof CatalogError) {
      console.error(`  ✗ ${err.message}`)
    } else {
      console.error(`  ✗ ${err instanceof Error ? err.message : String(err)}`)
    }
    return 1
  }

  const { catalog, source, ageMs } = result

  if (jsonMode) {
    console.log(JSON.stringify(catalog, null, 2))
    return 0
  }

  if (source === 'cache') {
    const hours = ageMs !== undefined ? Math.round(ageMs / 3_600_000) : '?'
    if (isCacheStale(ageMs)) {
      console.log(`  ⚠ using cached catalog (${hours}h old, stale) — network unavailable`)
    } else {
      console.log(`  ℹ using cached catalog (${hours}h old) — network unavailable`)
    }
  }

  console.log(`  Soulkiller catalog  v${catalog.version}  updated ${catalog.updated_at}\n`)
  const skills = catalog.skills
  if (skills.length === 0) {
    console.log('  (catalog is empty)\n')
    return 0
  }

  const slugWidth = Math.max(...skills.map((s) => s.slug.length), 10) + 2
  const nameWidth = Math.max(...skills.map((s) => s.display_name.length), 12) + 2
  const verWidth = Math.max(...skills.map((s) => s.version.length), 7) + 2

  console.log(`  ${'SLUG'.padEnd(slugWidth)}${'NAME'.padEnd(nameWidth)}${'VERSION'.padEnd(verWidth)}SIZE`)
  console.log(`  ${'─'.repeat(slugWidth + nameWidth + verWidth + 10)}`)
  for (const s of skills) {
    const sizeMB = (s.size_bytes / (1024 * 1024)).toFixed(2)
    console.log(`  ${s.slug.padEnd(slugWidth)}${s.display_name.padEnd(nameWidth)}${s.version.padEnd(verWidth)}${sizeMB} MB`)
  }
  console.log()
  return 0
}
