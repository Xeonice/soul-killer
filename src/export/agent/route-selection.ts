/**
 * Route Selection step — runs between Character Loop and Finalize.
 *
 * Pure code logic (no LLM agent needed):
 * 1. Read plan.route_candidates as pre-selection
 * 2. Present multi-select list to user via askUser (pre-recommended checked)
 * 3. Call builder.setRouteCharacters with final selection
 */

import type { ExportPlan, OnExportProgress, AskUserHandler, AskUserOption } from './types.js'
import { ExportBuilder } from './types.js'
import { logger } from '../../infra/utils/logger.js'

export async function runRouteSelection(
  plan: ExportPlan,
  builder: ExportBuilder,
  onProgress: OnExportProgress,
  askUser: AskUserHandler,
): Promise<boolean> {
  const tag = '[route-selection]'

  const candidates = plan.route_candidates ?? []

  // Skip if no candidates or single-character scenario
  if (candidates.length === 0) {
    logger.info(`${tag} No route candidates — skipping route selection`)
    return true
  }

  onProgress({ type: 'phase', phase: 'route_selection' })
  onProgress({ type: 'tool_start', tool: 'select_route_characters' })

  // Build multi-select options from ALL plan characters, pre-select the recommended ones
  const candidateSlugs = new Set(candidates.map(c => c.slug))
  const options: AskUserOption[] = plan.characters.map(c => ({
    label: c.name,
    description: candidates.find(r => r.slug === c.name)?.reason,
    preSelected: candidateSlugs.has(c.name),
  }))

  const answer = await askUser(
    '选择路线焦点角色（最多 4 个，推荐的已预选）：',
    options,
    false, // no free input
    true,  // multi-select
    4,     // max 4 route characters
  )

  // answer is comma-separated labels from the multi-select UI
  const selectedNames = answer.split(',').map(s => s.trim()).filter(Boolean)

  if (selectedNames.length === 0) {
    logger.info(`${tag} No route characters selected — skipping`)
    onProgress({ type: 'tool_end', tool: 'select_route_characters', result_summary: 'skipped: none selected' })
    return true
  }

  // Build final candidates from selected names (max 4)
  const finalCandidates = selectedNames
    .map(name => {
      const candidateMatch = candidates.find(c => c.name === name)
      return {
        slug: name,
        name,
        reason: candidateMatch?.reason ?? 'Selected by user',
      }
    })

  // Apply to builder
  try {
    builder.setRouteCharacters(finalCandidates)
    const summary = `${finalCandidates.length} route characters: ${finalCandidates.map(c => c.name).join(', ')}`
    logger.info(`${tag} ${summary}`)
    onProgress({ type: 'tool_end', tool: 'select_route_characters', result_summary: summary })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    logger.warn(`${tag} Failed to set route characters: ${msg}`)
    onProgress({ type: 'tool_end', tool: 'select_route_characters', result_summary: `error: ${msg}` })
  }

  return true
}
