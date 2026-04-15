import { createOpenAICompatible } from '@ai-sdk/openai-compatible'
import { withExacto, getProviderOptions } from '../../infra/llm/client.js'
import type { SoulkillerConfig } from '../../config/schema.js'
import type {
  OnExportProgress,
  AskUserHandler,
  PreSelectedExportData,
  PlanConfirmHandler,
} from './types.js'
import { ExportBuilder } from './types.js'
import { runPlanningLoop } from './planning.js'
import { runStorySetup } from './story-setup.js'
import { runCharacterLoop } from './character.js'
import { runRouteSelection } from './route-selection.js'
import { finalizeAndPackage } from './finalize.js'
import { logger } from '../../infra/utils/logger.js'
import { AgentLogger } from '../../infra/utils/agent-logger.js'

export async function runExportAgent(
  config: SoulkillerConfig,
  preSelected: PreSelectedExportData,
  onProgress: OnExportProgress,
  askUser: AskUserHandler,
  waitForPlanConfirm?: PlanConfirmHandler,
): Promise<void> {
  const tag = '[export-agent]'
  logger.info(`${tag} Starting export agent`, {
    souls: preSelected.souls,
    world: preSelected.worldName,
  })

  onProgress({ type: 'phase', phase: 'initiating' })

  const provider = createOpenAICompatible({
    name: 'openrouter',
    apiKey: config.llm.api_key,
    baseURL: process.env.SOULKILLER_API_URL ?? 'https://openrouter.ai/api/v1',
  })
  const modelName = config.llm.default_model
  const model = provider(withExacto(modelName))
  const providerOpts = getProviderOptions(modelName)

  // Dedicated log file for export runs — separate from capture/distill logs
  const promptLabel = `Export Skill: ${preSelected.souls.join(',')} in ${preSelected.worldName}`
  const agentLog = new AgentLogger(promptLabel, {
    model: config.llm.default_model,
    provider: 'openrouter',
    subdir: 'export',
  })
  logger.info(`${tag} Agent log: ${agentLog.filePath}`)

  // ─── Phase 1: Planning ─────────────────────────────────────────────
  const plan = await runPlanningLoop(model, preSelected, onProgress, agentLog, providerOpts)
  if (!plan) {
    agentLog.close()
    return // Planning failed — error already emitted
  }

  // ─── Phase 2: Plan confirmation ────────────────────────────────────
  onProgress({ type: 'phase', phase: 'plan_review' })
  onProgress({ type: 'plan_ready', plan, storyDirection: preSelected.storyDirection, exportLanguage: preSelected.exportLanguage })

  // Wait for user to confirm the plan via the UI's Enter/Esc interaction.
  // The panel renders a plan_review zone; Enter triggers onPlanConfirm,
  // Esc triggers onCancel — both resolve the promise.
  const confirmed = waitForPlanConfirm ? await waitForPlanConfirm() : true
  onProgress({ type: 'plan_confirmed' })

  if (!confirmed) {
    logger.info(`${tag} User cancelled after plan review`)
    agentLog.toolInternal('User cancelled after plan review')
    agentLog.close()
    onProgress({ type: 'error', error: 'User cancelled export' })
    return
  }

  // ─── Phase 3: Execution (3 independent sub-phases) ──────────────────

  const builder = new ExportBuilder(preSelected.souls, preSelected.worldName)
  // Lock in the author-declared skill version so packager writes it to
  // soulkiller.json. The wizard guarantees preSelected.authorVersion is
  // non-empty at submit time.
  builder.setAuthorVersion(preSelected.authorVersion)

  onProgress({ type: 'phase', phase: 'analyzing' })

  // Step 1: Story Setup (metadata + state + prose)
  const storyOk = await runStorySetup(model, plan, preSelected, builder, onProgress, askUser, agentLog, providerOpts)
  if (!storyOk) { agentLog.close(); return }

  // Step 2: Character Loop (per-character add + axes)
  const charsOk = await runCharacterLoop(model, plan, preSelected, builder, onProgress, agentLog, providerOpts)
  if (!charsOk) { agentLog.close(); return }

  // Step 2.5: Route Selection (if plan has route_candidates)
  const routeOk = await runRouteSelection(plan, builder, onProgress, askUser)
  if (!routeOk) { agentLog.close(); return }

  // Step 3: Finalize (pure code packaging)
  const finalOk = await finalizeAndPackage(builder, preSelected, onProgress, agentLog)
  if (!finalOk) { agentLog.close(); return }

  agentLog.close()
}

// Re-export all public types and functions
export {
  computeExportStepCap,
  __TEST_ONLY_ExportBuilder,
  ExportBuilder,
  type StoryMetadata,
  type CharacterDraft,
  type ExportPlanCharacter,
  type ExportPlan,
  type ExportProgressEvent,
  type ExportPhase,
  type AskUserOption,
  type OnExportProgress,
  type AskUserHandler,
  type SoulFullData,
  type WorldFullData,
  type PreSelectedExportData,
  type PlanConfirmHandler,
} from './types.js'

export { validatePlan, __TEST_ONLY_validatePlan } from './planning.js'
