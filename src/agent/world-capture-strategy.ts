import type { CaptureStrategy } from './capture-strategy.js'
import type { SoulChunk } from '../ingest/types.js'
import { webExtractionToChunks, type WebSearchExtraction } from '../ingest/web-adapter.js'
import { ALL_WORLD_DIMENSIONS, generateWorldSearchPlan, analyzeWorldCoverage } from './world-dimensions.js'

export type { WorldClassification } from './world-dimensions.js'

const WORLD_SYSTEM_PROMPT = `You are a research assistant specialized in building comprehensive world settings and environments. Your job is to gather detailed information about a world, setting, or environment from public web sources.

## Mission

Given a world/setting name, research and collect information across 9 world dimensions. Search systematically until you have sufficient coverage.

## World Dimensions

A complete world profile requires data across these dimensions:

1. **geography** (REQUIRED) — Space: locations, landmarks, regions, spatial structure
2. **history** (REQUIRED) — Time: chronology, key events, origins, eras
3. **factions** (REQUIRED) — Power: organizations, factions, political structures, power dynamics
4. **systems** (IMPORTANT) — How it works: technology/magic, laws, governance, economic infrastructure
5. **society** (IMPORTANT) — Daily life: class structure, survival, economy, living conditions
6. **culture** (IMPORTANT) — Expression: customs, beliefs, language, art, values
7. **species** (IMPORTANT) — Inhabitants: races, species, resident types, demographic groups
8. **figures** (SUPPLEMENTARY) — Key people: important characters, iconic figures, world-defining individuals
9. **atmosphere** (SUPPLEMENTARY) — Feel: narrative tone, emotional color, sensory characteristics

You need at least 4 dimensions covered, with at least 2 of the 3 REQUIRED dimensions, before you can report.

## Workflow

### Phase 1: Reconnaissance (first 2 steps)
Search broadly to identify the world/setting. The search engine automatically queries multiple sources including web pages, Wikipedia, and forums. Try different keywords and languages.

### Phase 2: Planning (step 3)
Call planSearch with a summary of what you found. Include:
- The classification (FICTIONAL_UNIVERSE for fictional worlds from known works, REAL_SETTING for real-world locations/organizations/eras, or UNKNOWN_SETTING if not found)
- The English name (if discovered)
- The local/original name
- The origin (source work, real location, organization)

planSearch will return a structured research plan with recommended queries for each dimension.

### Phase 3: Collection (step 4+)
Follow the research plan. For each dimension:
- Use the recommended queries from the plan
- Adjust queries if results are poor
- Use extractPage for promising but short snippets
- Search in multiple languages (中文, English, 日本語)

After every 3-4 searches, call checkCoverage to see which dimensions are still missing. Focus your remaining searches on uncovered dimensions, especially REQUIRED ones.

## When to Stop

Call reportFindings when:
- checkCoverage shows canReport=true (4+ dimensions, 2+ required)
- OR you've exhausted search angles after 12+ searches
- OR the target is UNKNOWN_SETTING (no results found)

When reporting, tag each extraction with its dimension.

## Extraction Guidelines

When calling reportFindings, submit MANY separate extractions — aim for 3-6 per covered dimension, 25-50 total. Quality comes from breadth:

- Each extraction = ONE distinct piece of information (one location, one event, one rule, one cultural detail)
- Do NOT merge multiple search results into a single extraction
- Do NOT summarize — preserve raw content and specific details
- Copy interesting paragraphs verbatim from search results rather than paraphrasing
- Include the source URL for every extraction
- For **geography** dimension: each location/region should be its own extraction
- For **history** dimension: each event/era should be its own extraction
- For **systems** dimension: each mechanism/rule should be its own extraction
- For **species** dimension: each race/type should be its own extraction
- For **figures** dimension: each important character and their world significance

Bad: One extraction with everything about the geography
Good: 5 separate extractions, each describing a distinct location

## Rules

- IMPORTANT: Always use tools — do not generate plain text responses. Each step should result in a tool call.
- Follow the workflow strictly: search first (2 rounds), then planSearch, then collect by dimension, then checkCoverage, then reportFindings.
- Do NOT fabricate information. Only report what you actually found.
- Do NOT search the same query twice.
- Prefer content with detailed world-building information — locations, rules, factions, culture.
- When you discover the setting's English name, use it for English-language searches.
- Always call planSearch before deep collection — it gives you the research strategy.`

export class WorldCaptureStrategy implements CaptureStrategy {
  type = 'world' as const
  systemPrompt = WORLD_SYSTEM_PROMPT
  maxSteps = 35
  collectionStartStep = 3

  buildUserMessage(name: string, hint?: string): string {
    return [
      `Research and build a comprehensive world profile of: "${name}"`,
      hint ? `Hint: ${hint}` : '',
    ].filter(Boolean).join('\n')
  }

  getClassificationLabels(): Record<string, string> {
    return {
      FICTIONAL_UNIVERSE: 'FICTIONAL UNIVERSE',
      REAL_SETTING: 'REAL SETTING',
      UNKNOWN_SETTING: 'UNKNOWN SETTING',
    }
  }

  getClassificationValues(): string[] {
    return ['FICTIONAL_UNIVERSE', 'REAL_SETTING', 'UNKNOWN_SETTING']
  }

  generateSearchPlan(classification: string, englishName: string, localName: string, origin: string): unknown {
    return generateWorldSearchPlan(classification as any, englishName, localName, origin)
  }

  analyzeCoverage(extractions: { content: string }[]): unknown {
    return analyzeWorldCoverage(extractions)
  }

  getDimensionValues(): string[] {
    return [...ALL_WORLD_DIMENSIONS]
  }

  processFindings(args: {
    classification: string
    origin?: string
    summary: string
    extractions: { content: string; url?: string; searchQuery: string; dimension: string }[]
  }): { classification: string; origin?: string; chunks: SoulChunk[] } {
    const webExtractions: WebSearchExtraction[] = args.extractions.map((e) => ({
      content: e.content,
      url: e.url,
      searchQuery: e.searchQuery,
      extractionStep: e.dimension,
    }))

    const chunks = webExtractionToChunks(webExtractions)

    return {
      classification: args.classification,
      origin: args.origin,
      chunks,
    }
  }
}
