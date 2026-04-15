import { packageSkill, getSkillFileName } from '../packager.js'
import type { OnExportProgress, OnCatalogConfirm, PreSelectedExportData } from './types.js'
import { ExportBuilder } from './types.js'
import { logger } from '../../infra/utils/logger.js'
import type { AgentLogger } from '../../infra/utils/agent-logger.js'

// --- Finalize and package (pure code, no LLM) ---

export async function finalizeAndPackage(
  builder: ExportBuilder,
  preSelected: PreSelectedExportData,
  onProgress: OnExportProgress,
  agentLog: AgentLogger,
  onCatalogConfirm: OnCatalogConfirm,
): Promise<boolean> {
  const tag = '[export-finalize]'

  try {
    onProgress({ type: 'tool_start', tool: 'finalize_export' })

    // Build and validate
    const { souls, world_name, story_spec } = builder.build()

    // Inject story identity from preSelected into story_spec
    story_spec.story_name = preSelected.storyName
    if (preSelected.storyDirection && preSelected.storyDirection.trim().length > 0) {
      story_spec.user_direction = preSelected.storyDirection.trim()
    }

    // skill-catalog-autogen: pause for author confirmation of catalog fields.
    // The LLM produced candidates during set_story_metadata; the wizard now
    // shows them for edit/approve. A `null` response means the author pressed
    // Esc to cancel the entire export.
    const candidates = builder.getCatalogCandidates()
    onProgress({ type: 'catalog_confirm_request', candidates })
    const confirmed = await onCatalogConfirm(candidates)
    if (confirmed === null) {
      logger.info(`${tag} catalog confirm cancelled by user — skipping packageSkill`)
      onProgress({ type: 'tool_end', tool: 'finalize_export', result_summary: 'cancelled by user' })
      return false
    }

    onProgress({ type: 'phase', phase: 'packaging' })
    const steps = ['copy_souls', 'copy_world', 'gen_story_spec', 'gen_skill']
    for (const s of steps) {
      onProgress({ type: 'package_step', step: s, status: 'pending' })
    }
    onProgress({ type: 'package_step', step: 'copy_souls', status: 'running' })

    const result = packageSkill({
      souls,
      world_name,
      story_name: preSelected.storyName,
      story_spec,
      output_base_dir: preSelected.outputBaseDir,
      catalog_info: confirmed,
    })

    for (const s of steps) {
      onProgress({ type: 'package_step', step: s, status: 'done' })
    }

    const skillFileName = getSkillFileName(preSelected.storyName, world_name)
    const sizeKB = Math.round(result.size_bytes / 1024)

    onProgress({ type: 'tool_end', tool: 'finalize_export', result_summary: `${result.file_count} files, ${sizeKB} KB, ${souls.length} souls` })
    onProgress({
      type: 'complete',
      output_file: result.output_file,
      file_count: result.file_count,
      size_bytes: result.size_bytes,
      skill_name: skillFileName,
    })
    onProgress({ type: 'phase', phase: 'complete' })

    logger.info(`${tag} Package complete: ${result.file_count} files, ${sizeKB} KB`)
    return true
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err)
    logger.error(`${tag} finalize_export failed:`, errMsg)
    onProgress({ type: 'tool_end', tool: 'finalize_export', result_summary: `error: ${errMsg}` })
    agentLog.toolInternal(`FATAL: finalize failed: ${errMsg}`)
    onProgress({ type: 'error', error: `Packaging failed: ${errMsg}\nSee detailed log: ${agentLog.filePath}` })
    return false
  }
}
