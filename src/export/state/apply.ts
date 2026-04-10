/**
 * `state apply <script-id> <scene-id> <choice-id>`
 *
 * Core state-transition command. Reads the auto save's current state, locates
 * the choice's consequences from the script, applies each delta through
 * schema-aware semantics, writes the updated state.yaml + meta.yaml atomically.
 * Always operates on the script's auto/ save directory.
 */

import { applyDelta, type ChangeEntry } from './schema.js'
import { loadScriptFile, type ParsedScript } from './script.js'
import {
  resolveSavePaths,
  resolveScriptPath,
  readStateFile,
  readMetaFile,
  writeSaveTransaction,
  type MetaFile,
} from './io.js'

export interface ApplyResult {
  scriptId: string
  fromScene: string
  toScene: string
  choiceId: string
  changes: ChangeEntry[]
}

export function runApply(
  skillRoot: string,
  scriptId: string,
  sceneId: string,
  choiceId: string
): ApplyResult {
  const paths = resolveSavePaths(skillRoot, scriptId)

  const meta = readMetaFile(paths.metaYamlPath)
  const scriptPath = resolveScriptPath(skillRoot, meta.scriptRef)
  const script = loadScriptFile(scriptPath)
  const parsedState = readStateFile(paths.stateYamlPath)

  const scene = script.scenes.get(sceneId)
  if (!scene) {
    throw new Error(`scene "${sceneId}" not found in script "${script.id}"`)
  }
  const choice = scene.choices.find((c) => c.id === choiceId)
  if (!choice) {
    throw new Error(
      `scene "${sceneId}" has no choice "${choiceId}" ` +
        `(available: ${scene.choices.map((c) => c.id).join(', ')})`
    )
  }

  // Apply each consequences entry. Collect change entries for stdout.
  const working = { ...parsedState.state }
  const changes: ChangeEntry[] = []
  for (const [key, rawDelta] of Object.entries(choice.consequences)) {
    changes.push(applyDelta(script.schema, working, key, rawDelta))
  }

  // Determine next scene: explicit `next` > first scene-id after the current in source order.
  const nextScene = resolveNextScene(script, sceneId, choice.next)

  const newMeta: MetaFile = {
    scriptRef: meta.scriptRef,
    currentScene: nextScene,
    lastPlayedAt: new Date().toISOString(),
  }

  writeSaveTransaction(
    paths,
    { currentScene: nextScene, state: working },
    newMeta
  )

  return {
    scriptId: meta.scriptRef,
    fromScene: sceneId,
    toScene: nextScene,
    choiceId,
    changes,
  }
}

function resolveNextScene(
  script: ParsedScript,
  currentSceneId: string,
  explicitNext: string | undefined
): string {
  if (explicitNext !== undefined) {
    if (!script.scenes.has(explicitNext)) {
      throw new Error(
        `choice.next "${explicitNext}" does not exist in script scenes`
      )
    }
    return explicitNext
  }
  // Fallback: the next scene in declaration order.
  const ids = Array.from(script.scenes.keys())
  const idx = ids.indexOf(currentSceneId)
  if (idx === -1 || idx === ids.length - 1) {
    // Staying on the same scene is the safe default when no `next` given and
    // there's no later scene. Phase 2 should normally hit an ending before this.
    return currentSceneId
  }
  return ids[idx + 1]!
}
