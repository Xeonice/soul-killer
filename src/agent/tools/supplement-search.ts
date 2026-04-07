import fs from 'node:fs'
import path from 'node:path'
import { tool } from 'ai'
import { z } from 'zod'
import type { SoulkillerConfig } from '../../config/schema.js'
import type { SearchResult } from '../search/tavily-search.js'
import { executeTavilySearch } from '../search/tavily-search.js'
import { executeExaSearch } from '../search/exa-search.js'
import { searxngSearch } from '../search/searxng-search.js'
import { readDimensionCache } from './evaluate-dimension.js'
import type { AgentLogger } from '../../utils/agent-logger.js'

const MAX_SUPPLEMENTS_PER_DIM = 2

export function createSupplementSearchTool(
  config: SoulkillerConfig,
  sessionDir: string,
  options: { searxngAvailable?: boolean; agentLog?: AgentLogger },
) {
  const { agentLog } = options
  const supplementCounts = new Map<string, number>()

  const tavilyKey = config.search?.tavily_api_key
  const exaKey = config.search?.exa_api_key
  const configProvider = config.search?.provider
  const resolvedProvider = configProvider === 'searxng' && options.searxngAvailable ? 'searxng'
    : configProvider === 'exa' && exaKey ? 'exa'
    : configProvider === 'tavily' && tavilyKey ? 'tavily'
    : options.searxngAvailable ? 'searxng'
    : exaKey ? 'exa'
    : tavilyKey ? 'tavily'
    : 'none'

  return tool({
    description: 'Search for additional information for a specific dimension. Limited to 2 supplements per dimension. Pass keywords as an array — they will be joined into a search query.',
    inputSchema: z.object({
      dimensionName: z.string().describe('The dimension to supplement'),
      keywords: z.array(z.string()).describe('Search keywords (2-4 items, each a short phrase). Example: ["曹魏", "政治制度"] or ["Battle of Chibi", "tactics"]'),
    }),
    execute: async ({ dimensionName, keywords }) => {
      const query = keywords.join(' ')
      const count = supplementCounts.get(dimensionName) ?? 0
      if (count >= MAX_SUPPLEMENTS_PER_DIM) {
        agentLog?.toolInternal(`supplementSearch: ${dimensionName} hit limit`)
        return { error: `Supplement limit reached for "${dimensionName}" (max ${MAX_SUPPLEMENTS_PER_DIM}).`, results: [] }
      }

      agentLog?.toolInternal(`supplementSearch: ${dimensionName} "${query}"`)

      let results: SearchResult[]
      try {
        if (resolvedProvider === 'exa') results = await executeExaSearch(exaKey!, query)
        else if (resolvedProvider === 'tavily') results = await executeTavilySearch(tavilyKey!, query)
        else if (resolvedProvider === 'searxng') results = await searxngSearch(query)
        else results = []
      } catch (err) {
        return { error: `Search failed: ${String(err)}`, results: [] }
      }

      // Dedup against existing cache
      const existing = readDimensionCache(sessionDir, dimensionName)
      const existingUrls = new Set(existing.map((r) => r.url))
      results = results.filter((r) => !existingUrls.has(r.url))

      // Append to cache
      const combined = [...existing, ...results]
      const cacheFile = path.join(sessionDir, `${dimensionName}.json`)
      fs.writeFileSync(cacheFile, JSON.stringify({ results: combined }))
      supplementCounts.set(dimensionName, count + 1)

      agentLog?.toolInternal(`supplementSearch: ${results.length} new results (${count + 1}/${MAX_SUPPLEMENTS_PER_DIM})`)

      return {
        dimensionName,
        supplementsUsed: count + 1,
        supplementsRemaining: MAX_SUPPLEMENTS_PER_DIM - count - 1,
        newResults: results.length,
      }
    },
  })
}
