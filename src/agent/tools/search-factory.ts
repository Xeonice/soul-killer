import { tool } from 'ai'
import { z } from 'zod'
import type { SoulkillerConfig } from '../../config/schema.js'
import type { CaptureStrategy } from '../capture-strategy.js'
import { executeTavilySearch } from './tavily-search.js'
import type { SearchResult } from './tavily-search.js'
import { extractPagesParallel, extractPageContent } from './page-extractor.js'
import { searxngSearch } from './searxng-search.js'
import { executeExaSearch } from './exa-search.js'
import { logger } from '../../utils/logger.js'
import type { AgentLogger } from '../../utils/agent-logger.js'

/**
 * Creates AI SDK tool() definitions for ToolLoopAgent.
 * Tools have execute functions — the LLM calls them autonomously.
 * The strategy parameter determines the classification/dimension enums.
 */
export function createAgentTools(
  config: SoulkillerConfig,
  options?: { searxngAvailable?: boolean; agentLog?: AgentLogger; strategy?: CaptureStrategy; tags?: { domain?: string[] } },
) {
  const agentLog = options?.agentLog
  const strategy = options?.strategy
  const tags = options?.tags
  const tavilyKey = config.search?.tavily_api_key
  const exaKey = config.search?.exa_api_key
  const configProvider = config.search?.provider

  // Resolve search provider
  const resolvedProvider = configProvider === 'searxng' && options?.searxngAvailable ? 'searxng'
    : configProvider === 'exa' && exaKey ? 'exa'
    : configProvider === 'tavily' && tavilyKey ? 'tavily'
    : options?.searxngAvailable ? 'searxng'
    : exaKey ? 'exa'
    : tavilyKey ? 'tavily'
    : 'none'

  logger.info('[search-factory] Resolved provider:', resolvedProvider)

  const search = tool({
    description: 'Search for information about a person, character, or topic. The search engine automatically queries multiple sources including web pages, Wikipedia, and forums.',
    inputSchema: z.object({
      query: z.string().describe('The search query'),
    }),
    execute: async ({ query }) => {
      const searchStart = Date.now()
      agentLog?.toolInternal(`Provider: ${resolvedProvider}`)
      let results: SearchResult[]

      if (resolvedProvider === 'searxng') {
        const requestUrl = `http://localhost:8080/search?q=${encodeURIComponent(query)}&format=json&engines=google,bing,reddit,wikipedia`
        agentLog?.toolInternal(`Request URL: ${requestUrl}`)

        results = await searxngSearch(query)
        agentLog?.toolInternal(`Raw results: ${results.length}`, { durationMs: Date.now() - searchStart })

        const toExtract = results.filter((r) => r.url && r.content.length < 300).slice(0, 5)
        agentLog?.toolInternal(`Short snippets (< 300 chars): ${toExtract.length}`)

        if (toExtract.length > 0) {
          const pageStart = Date.now()
          const pages = await extractPagesParallel(toExtract.map((r) => r.url))
          for (const page of pages) {
            agentLog?.toolInternal(`  Page extract: ${page.url} → ${page.content ? `ok (${page.content.length} chars)` : 'failed'}`)
            if (page.content) {
              const idx = results.findIndex((r) => r.url === page.url)
              if (idx !== -1) {
                results[idx] = { ...results[idx]!, content: page.content }
              }
            }
          }
          agentLog?.toolInternal(`Page extraction batch duration: ${Date.now() - pageStart}ms`)
        }
      } else if (resolvedProvider === 'exa') {
        results = await executeExaSearch(exaKey!, query)
        agentLog?.toolInternal(`Results: ${results.length}`, { durationMs: Date.now() - searchStart })
      } else if (resolvedProvider === 'tavily') {
        results = await executeTavilySearch(tavilyKey!, query)
        agentLog?.toolInternal(`Results: ${results.length}`, { durationMs: Date.now() - searchStart })
      } else {
        logger.warn('[search-factory] No search provider available')
        agentLog?.toolInternal('No search provider available')
        results = []
      }

      agentLog?.toolInternal(`Total search duration: ${Date.now() - searchStart}ms`)
      return { results }
    },
  })

  const extractPage = tool({
    description: 'Extract the full content of a web page as markdown. Use when a search result snippet is too short and you need more detail.',
    inputSchema: z.object({
      url: z.string().describe('The URL to extract content from'),
    }),
    execute: async ({ url }) => {
      const extractStart = Date.now()
      agentLog?.toolInternal(`URL: ${url}`)
      const content = await extractPageContent(url)
      const dur = Date.now() - extractStart
      if (content) {
        agentLog?.toolInternal(`Success: ${content.length} chars`, { durationMs: dur })
      } else {
        agentLog?.toolInternal(`Failed to extract`, { durationMs: dur })
      }
      return { content: content ?? 'Failed to extract page content.' }
    },
  })

  const planSearch = tool({
    description: 'Generate a search plan based on reconnaissance results. Call this after initial searches to get a structured plan of what dimensions to search and recommended queries.',
    inputSchema: z.object({
      summary: z.string().describe('Summary of what you found so far, including the target classification, English name, local name, and origin/source work'),
    }),
    execute: async ({ summary }) => {
      const planStart = Date.now()
      agentLog?.toolInternal(`Summary length: ${summary.length} chars`)

      // Build classification regex from strategy values
      const classValues = strategy?.getClassificationValues() ?? ['DIGITAL_CONSTRUCT', 'PUBLIC_ENTITY', 'HISTORICAL_RECORD', 'UNKNOWN_ENTITY']
      const classRegex = new RegExp(classValues.join('|'), 'i')
      const classMatch = summary.match(classRegex)
      const unknownClass = classValues.find((c) => c.includes('UNKNOWN')) ?? classValues[classValues.length - 1]!
      const classification = classMatch?.[0]?.toUpperCase() ?? unknownClass

      const enNameMatch = summary.match(/(?:english\s*name|英文名)[:\s]*["']?([A-Za-z][\w\s.-]+)/i)
        ?? summary.match(/(?:known\s+as|called)\s+["']?([A-Za-z][\w\s.-]+)/i)
      const englishName = enNameMatch?.[1]?.trim() ?? ''

      const localNameMatch = summary.match(/(?:local\s*name|中文名|本名|原名)[:\s]*["']?([^\s"',]+)/i)
      const localName = localNameMatch?.[1]?.trim() ?? ''

      const originMatch = summary.match(/(?:origin|from|来自|出自|作品)[:\s]*["']?([^"'\n,]+)/i)
      const origin = originMatch?.[1]?.trim() ?? ''

      agentLog?.toolInternal(`Parsed: classification=${classification}, en=${englishName}, local=${localName}, origin=${origin}`)

      const plan = strategy
        ? strategy.generateSearchPlan(classification, englishName || localName, localName || englishName, origin, tags)
        : { classification, englishName, dimensions: [] }
      const dimCount = (plan as any).dimensions?.length ?? 0
      agentLog?.toolInternal(`Plan: ${dimCount} dimensions`, { durationMs: Date.now() - planStart })
      return plan
    },
  })

  const checkCoverage = tool({
    description: 'Check how well your collected information covers the profile dimensions. Call this after several searches to see what dimensions are still missing.',
    inputSchema: z.object({
      extractions: z.array(z.object({
        content: z.string().describe('The text content of the extraction'),
      })),
    }),
    execute: async ({ extractions }) => {
      const coverageStart = Date.now()
      agentLog?.toolInternal(`Extractions to analyze: ${extractions.length}`)
      const report = strategy
        ? strategy.analyzeCoverage(extractions)
        : { totalCovered: 0, canReport: false, suggestion: 'No strategy' }
      const totalCovered = (report as any).totalCovered ?? 0
      const canReport = (report as any).canReport ?? false
      agentLog?.toolInternal(`Coverage: ${totalCovered} dims, canReport=${canReport}`, { durationMs: Date.now() - coverageStart })
      return report
    },
  })

  // Build dynamic enums from strategy
  const classificationValues = strategy?.getClassificationValues() ?? ['DIGITAL_CONSTRUCT', 'PUBLIC_ENTITY', 'HISTORICAL_RECORD', 'UNKNOWN_ENTITY']
  const dimensionValues = strategy?.getDimensionValues() ?? ['identity', 'quotes', 'expression', 'thoughts', 'behavior', 'relations']

  const reportFindings = tool({
    description: 'Report your findings when you have gathered enough information about the target. Calling this tool ends the search. Only call after checkCoverage shows canReport=true, or after exhausting search options. Submit 20-40 extractions total, with 3-8 per dimension.',
    inputSchema: z.object({
      classification: z.enum(classificationValues as [string, ...string[]])
        .describe('The target type classification'),
      origin: z.string().optional().describe('Source work, organization, or era'),
      summary: z.string().describe('One paragraph summary of who/what the target is'),
      extractions: z.array(z.object({
        content: z.string().describe('A single piece of extracted information — one fact, one quote, or one observation. Do NOT merge multiple findings into one extraction. Copy raw content from search results rather than summarizing.'),
        url: z.string().optional().describe('Source URL'),
        searchQuery: z.string().describe('The search query that found this'),
        dimension: z.enum(dimensionValues as [string, ...string[]])
          .describe('Which profile dimension this extraction belongs to'),
      })),
    }),
    // No execute function — calling this tool stops the agent loop
  })

  return { search, extractPage, planSearch, checkCoverage, reportFindings }
}
