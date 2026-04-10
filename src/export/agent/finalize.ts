import { packageSkill, getSkillFileName } from '../packager.js'
import type { OnExportProgress, PreSelectedExportData } from './types.js'
import { ExportBuilder } from './types.js'
import { logger } from '../../infra/utils/logger.js'
import type { AgentLogger } from '../../infra/utils/agent-logger.js'

// --- Finalize and package (pure code, no LLM) ---

export async function finalizeAndPackage(
  builder: ExportBuilder,
  preSelected: PreSelectedExportData,
  onProgress: OnExportProgress,
  agentLog: AgentLogger,
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
