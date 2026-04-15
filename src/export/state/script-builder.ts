/**
 * Incremental script builder — plan / scene / ending / build.
 *
 * Phase 1 LLM generates script in steps:
 * 1. Plan: narrative blueprint (schema, outlines, scene graph)
 * 2. Scenes: one at a time, in topological order
 * 3. Endings: after all scenes, based on actual scene content
 * 4. Build: merge into final script-<id>.json
 */

import {
  readFileSync,
  writeFileSync,
  existsSync,
  mkdirSync,
  readdirSync,
  renameSync,
  unlinkSync,
  rmSync,
  statSync,
} from 'node:fs'
import { join, dirname } from 'node:path'
import { loadStateSchema, type StateSchema } from './schema.js'
import type { MiniPrimitive } from './mini-yaml.js'

// ── Plan types ───────────────────────────────────────────────────

export interface PlanChoice {
  id: string
  text: string
  intent: string
  next: string
}

export interface PlanRoutingEntry {
  route_id: string
  condition: unknown
  next: string
}

export interface PlanScene {
  act: number
  title: string
  cast?: string[]
  outline: string
  emotional_beat?: string
  state_changes_intent?: Record<string, MiniPrimitive>
  choices: PlanChoice[]
  continuity?: string
  context_refs?: string[]
  // Route support:
  type?: 'affinity_gate'
  routing?: PlanRoutingEntry[]
  route?: string
  // Auto-computed by CLI:
  predecessors?: string[]
  is_convergence?: boolean
}

export interface PlanRoute {
  id: string
  focus_character: string
  name: string
  theme: string
  scenes: string[]
}

export interface PlanEnding {
  id: string
  title: string
  condition: unknown
  intent: string
  route?: string
}

export interface PlanNarrative {
  arc: string
  acts: Array<{ act: number; title: string; theme: string; scenes: string[] }>
  character_arcs?: Record<string, { arc: string; key_scenes: string[] }>
}

export interface ScriptPlan {
  id: string
  state_schema: Record<string, unknown>
  initial_state: Record<string, MiniPrimitive>
  narrative: PlanNarrative
  routes?: PlanRoute[]
  scenes: Record<string, PlanScene>
  endings: PlanEnding[]
  generation_order?: string[]
}

// ── Scene / ending draft types ───────────────────────────────────

export interface SceneDraft {
  text: string
  choices: Array<{
    id: string
    text: string
    consequences: Record<string, MiniPrimitive>
    next: string
  }>
  route?: string
}

export interface EndingDraft {
  id: string
  title: string
  condition: unknown
  body: string
}

// ── Build paths ──────────────────────────────────────────────────

function buildDir(skillRoot: string, scriptId: string): string {
  return join(skillRoot, 'runtime', 'scripts', `.build-${scriptId}`)
}

function planPath(skillRoot: string, scriptId: string): string {
  return join(buildDir(skillRoot, scriptId), 'plan.json')
}

function draftPath(skillRoot: string, scriptId: string, name: string): string {
  return join(buildDir(skillRoot, scriptId), 'draft', `${name}.json`)
}

function scenePath(skillRoot: string, scriptId: string, sceneId: string): string {
  return join(buildDir(skillRoot, scriptId), 'scenes', `${sceneId}.json`)
}

function endingPath(skillRoot: string, scriptId: string, endingId: string): string {
  return join(buildDir(skillRoot, scriptId), 'endings', `${endingId}.json`)
}

// ── runScriptPlan ────────────────────────────────────────────────

export interface PlanResult {
  ok: true
  scenes: number
  fields: number
  acts: number
  endings: number
  generationOrder: string[]
  convergencePoints: string[]
}

export interface PlanError {
  ok: false
  error: string
}

export function runScriptPlan(skillRoot: string, scriptId: string): PlanResult | PlanError {
  const path = planPath(skillRoot, scriptId)
  if (!existsSync(path)) {
    return { ok: false, error: `plan.json not found at ${path}` }
  }

  let plan: ScriptPlan
  try {
    plan = JSON.parse(readFileSync(path, 'utf8'))
  } catch (err) {
    return { ok: false, error: `plan.json is not valid JSON: ${(err as Error).message}` }
  }

  // Validate state_schema
  try {
    loadStateSchema(plan.state_schema)
  } catch (err) {
    return { ok: false, error: `state_schema invalid: ${(err as Error).message}` }
  }

  // Validate initial_state == schema keys
  const schemaKeys = new Set(Object.keys(plan.state_schema))
  const initKeys = new Set(Object.keys(plan.initial_state))
  for (const k of schemaKeys) {
    if (!initKeys.has(k)) return { ok: false, error: `initial_state missing field "${k}"` }
  }
  for (const k of initKeys) {
    if (!schemaKeys.has(k)) return { ok: false, error: `initial_state has extra field "${k}"` }
  }

  const sceneIds = new Set(Object.keys(plan.scenes))
  if (sceneIds.size === 0) {
    return { ok: false, error: 'plan.scenes must not be empty' }
  }

  // Validate each scene
  for (const [sid, scene] of Object.entries(plan.scenes)) {
    if (!scene.outline || scene.outline.trim() === '') {
      return { ok: false, error: `scene "${sid}" missing outline` }
    }

    // Gate scenes have routing instead of choices
    if (scene.type === 'affinity_gate') {
      if (!Array.isArray(scene.routing) || scene.routing.length === 0) {
        return { ok: false, error: `gate scene "${sid}" missing routing array` }
      }
      const lastRouting = scene.routing[scene.routing.length - 1]!
      if (lastRouting.condition !== 'default') {
        return { ok: false, error: `gate scene "${sid}" routing last entry must be condition: "default"` }
      }
      for (const r of scene.routing) {
        if (!r.route_id) {
          return { ok: false, error: `gate scene "${sid}" routing entry missing route_id` }
        }
        if (r.next && !sceneIds.has(r.next)) {
          return { ok: false, error: `gate scene "${sid}" routing next "${r.next}" does not exist` }
        }
      }
    } else {
      // Normal scene
      if (!Array.isArray(scene.choices)) {
        return { ok: false, error: `scene "${sid}" missing choices array` }
      }
      if (scene.choices.length > 3) {
        return { ok: false, error: `scene "${sid}" has ${scene.choices.length} choices (max 3)` }
      }
      for (const c of scene.choices) {
        if (c.next && !sceneIds.has(c.next)) {
          return { ok: false, error: `scene "${sid}" choice "${c.id}" next "${c.next}" does not exist` }
        }
      }
    }

    if (scene.context_refs) {
      for (const ref of scene.context_refs) {
        if (!sceneIds.has(ref)) {
          return { ok: false, error: `scene "${sid}" context_ref "${ref}" does not exist` }
        }
      }
    }
  }

  // Validate routes (if present)
  if (plan.routes && plan.routes.length > 0) {
    const routeIds = new Set(plan.routes.map((r) => r.id))
    // Each route's scenes must exist
    for (const route of plan.routes) {
      for (const sid of route.scenes) {
        if (!sceneIds.has(sid)) {
          return { ok: false, error: `route "${route.id}" references non-existent scene "${sid}"` }
        }
      }
    }
    // Each route must have at least 1 ending
    for (const route of plan.routes) {
      const routeEndings = plan.endings.filter((e) => e.route === route.id)
      if (routeEndings.length === 0) {
        return { ok: false, error: `route "${route.id}" has no endings` }
      }
    }
    // Route scene count balance warning (not blocking)
    const routeSceneCounts = plan.routes.map((r) => r.scenes.length)
    const maxCount = Math.max(...routeSceneCounts)
    const minCount = Math.min(...routeSceneCounts)
    if (maxCount - minCount > 2) {
      // Warning only, don't block — logged to stderr by caller if needed
    }
  }

  // Validate endings
  if (!Array.isArray(plan.endings) || plan.endings.length === 0) {
    return { ok: false, error: 'plan.endings must be a non-empty array' }
  }
  for (const ending of plan.endings) {
    if (!ending.id || !ending.title) {
      return { ok: false, error: 'each ending must have id and title' }
    }
    if (!ending.intent || ending.intent.trim() === '') {
      return { ok: false, error: `ending "${ending.id}" missing intent` }
    }
  }

  // Auto-compute predecessors + is_convergence
  const predecessorsMap = new Map<string, string[]>()
  for (const sid of sceneIds) predecessorsMap.set(sid, [])

  for (const [sid, scene] of Object.entries(plan.scenes)) {
    if (scene.type === 'affinity_gate' && scene.routing) {
      for (const r of scene.routing) {
        if (r.next && sceneIds.has(r.next)) {
          predecessorsMap.get(r.next)!.push(sid)
        }
      }
    } else if (scene.choices) {
      for (const c of scene.choices) {
        if (c.next && sceneIds.has(c.next)) {
          predecessorsMap.get(c.next)!.push(sid)
        }
      }
    }
  }

  for (const [sid, preds] of predecessorsMap) {
    plan.scenes[sid]!.predecessors = preds
    plan.scenes[sid]!.is_convergence = preds.length > 1
  }

  // Topological sort + cycle detection
  const topoResult = topologicalSort(plan.scenes)
  if (!topoResult.ok) {
    return { ok: false, error: topoResult.error }
  }
  plan.generation_order = topoResult.order

  // Write enriched plan back
  writeFileSync(path, JSON.stringify(plan, null, 2), 'utf8')

  // Ensure subdirectories exist
  const bd = buildDir(skillRoot, scriptId)
  mkdirSync(join(bd, 'draft'), { recursive: true })
  mkdirSync(join(bd, 'scenes'), { recursive: true })
  mkdirSync(join(bd, 'endings'), { recursive: true })

  const convergencePoints = Object.entries(plan.scenes)
    .filter(([, s]) => s.is_convergence)
    .map(([id]) => id)

  return {
    ok: true,
    scenes: sceneIds.size,
    fields: schemaKeys.size,
    acts: plan.narrative?.acts?.length ?? 0,
    endings: plan.endings.length,
    generationOrder: topoResult.order,
    convergencePoints,
  }
}

// ── Topological sort ─────────────────────────────────────────────

interface TopoOk { ok: true; order: string[] }
interface TopoError { ok: false; error: string }

export function topologicalSort(scenes: Record<string, PlanScene>): TopoOk | TopoError {
  const ids = Object.keys(scenes)
  if (ids.length === 0) return { ok: true, order: [] }

  // Build adjacency: scene → set of scenes it points to via choices
  const outEdges = new Map<string, string[]>()
  const inDegree = new Map<string, number>()

  for (const id of ids) {
    outEdges.set(id, [])
    inDegree.set(id, 0)
  }

  for (const [sid, scene] of Object.entries(scenes)) {
    // Gate scenes use routing instead of choices
    if (scene.type === 'affinity_gate' && scene.routing) {
      for (const r of scene.routing) {
        if (r.next && scenes[r.next]) {
          outEdges.get(sid)!.push(r.next)
          inDegree.set(r.next, (inDegree.get(r.next) ?? 0) + 1)
        }
      }
    } else if (scene.choices) {
      for (const c of scene.choices) {
        if (c.next && scenes[c.next]) {
          outEdges.get(sid)!.push(c.next)
          inDegree.set(c.next, (inDegree.get(c.next) ?? 0) + 1)
        }
      }
    }
  }

  // Kahn's algorithm
  const queue: string[] = []
  for (const [id, deg] of inDegree) {
    if (deg === 0) queue.push(id)
  }

  const order: string[] = []
  while (queue.length > 0) {
    const node = queue.shift()!
    order.push(node)
    for (const next of outEdges.get(node)!) {
      const newDeg = inDegree.get(next)! - 1
      inDegree.set(next, newDeg)
      if (newDeg === 0) queue.push(next)
    }
  }

  if (order.length !== ids.length) {
    const remaining = ids.filter(id => !order.includes(id))
    return { ok: false, error: `cycle detected involving: ${remaining.join(', ')}` }
  }

  return { ok: true, order }
}

// ── runScriptScene ───────────────────────────────────────────────

export interface SceneResult {
  ok: true
  sceneId: string
  choices: number
  consequenceKeys: number
}

export interface SceneError {
  ok: false
  error: string
}

export function runScriptScene(
  skillRoot: string,
  scriptId: string,
  sceneId: string,
): SceneResult | SceneError {
  // Read plan
  const pPath = planPath(skillRoot, scriptId)
  if (!existsSync(pPath)) return { ok: false, error: 'plan.json not found — run script plan first' }
  let plan: ScriptPlan
  try {
    plan = JSON.parse(readFileSync(pPath, 'utf8'))
  } catch { return { ok: false, error: 'plan.json is not valid JSON' } }

  // Check scene-id exists in plan
  const planScene = plan.scenes[sceneId]
  if (!planScene) {
    return { ok: false, error: `scene "${sceneId}" not found in plan.scenes` }
  }

  // Gate scenes: validate JSON,补全 type/routing/choices from plan, then write
  if (planScene.type === 'affinity_gate') {
    const dp = draftPath(skillRoot, scriptId, sceneId)
    if (!existsSync(dp)) {
      return { ok: false, error: `draft/${sceneId}.json not found` }
    }
    let draft: Record<string, unknown>
    try {
      draft = JSON.parse(readFileSync(dp, 'utf8'))
    } catch (err) {
      return { ok: false, error: `draft/${sceneId}.json JSON error: ${(err as Error).message}` }
    }
    // Check predecessors ready
    if (planScene.predecessors) {
      for (const pred of planScene.predecessors) {
        if (!existsSync(scenePath(skillRoot, scriptId, pred))) {
          return { ok: false, error: `gate "${sceneId}" predecessor "${pred}" not yet generated` }
        }
      }
    }
    //补全结构字段 from plan (single source of truth)
    draft.type = 'affinity_gate'
    draft.choices = draft.choices ?? []
    if (planScene.routing) {
      draft.routing = planScene.routing
    }
    const dest = scenePath(skillRoot, scriptId, sceneId)
    mkdirSync(dirname(dest), { recursive: true })
    writeFileSync(dest, JSON.stringify(draft, null, 2), 'utf8')
    // Clean up draft
    try { unlinkSync(dp) } catch { /* ignore */ }
    return { ok: true, sceneId, choices: 0, consequenceKeys: 0 }
  }

  // Read draft
  const dp = draftPath(skillRoot, scriptId, sceneId)
  if (!existsSync(dp)) {
    return { ok: false, error: `draft/${sceneId}.json not found` }
  }
  let draft: SceneDraft
  try {
    draft = JSON.parse(readFileSync(dp, 'utf8'))
  } catch (err) {
    return { ok: false, error: `draft/${sceneId}.json JSON error: ${(err as Error).message}` }
  }

  // Validate text
  if (!draft.text || draft.text.trim() === '') {
    return { ok: false, error: `scene "${sceneId}" text is empty` }
  }

  // Validate choices match plan
  if (!Array.isArray(draft.choices)) {
    return { ok: false, error: `scene "${sceneId}" choices must be an array` }
  }
  if (draft.choices.length !== planScene.choices.length) {
    return {
      ok: false,
      error: `scene "${sceneId}" has ${draft.choices.length} choices but plan expects ${planScene.choices.length}`,
    }
  }
  for (let i = 0; i < draft.choices.length; i++) {
    const dc = draft.choices[i]!
    const pc = planScene.choices[i]!
    if (dc.id !== pc.id) {
      return { ok: false, error: `scene "${sceneId}" choice[${i}].id "${dc.id}" != plan "${pc.id}"` }
    }
    if (dc.next !== pc.next) {
      return { ok: false, error: `scene "${sceneId}" choice[${i}].next "${dc.next}" != plan "${pc.next}"` }
    }
  }

  // Validate consequences keys ⊂ schema
  const schema = loadStateSchema(plan.state_schema)
  let totalKeys = 0
  for (const choice of draft.choices) {
    if (!choice.consequences) continue
    for (const key of Object.keys(choice.consequences)) {
      if (!(key in schema)) {
        return { ok: false, error: `scene "${sceneId}" consequence key "${key}" not in state_schema` }
      }
      totalKeys++
    }
  }

  // Check predecessors are ready (topological order enforcement)
  if (planScene.predecessors) {
    for (const pred of planScene.predecessors) {
      const sp = scenePath(skillRoot, scriptId, pred)
      if (!existsSync(sp)) {
        return {
          ok: false,
          error: `scene "${sceneId}" predecessor "${pred}" not yet generated (topological order violation)`,
        }
      }
    }
  }

  // Inject route label from plan.routes if applicable
  if (plan.routes && plan.routes.length > 0) {
    for (const route of plan.routes) {
      if (route.scenes.includes(sceneId)) {
        draft.route = route.id
        break
      }
    }
  }

  // Write scene (with possible route injection) to scenes/
  const dest = scenePath(skillRoot, scriptId, sceneId)
  mkdirSync(dirname(dest), { recursive: true })
  writeFileSync(dest, JSON.stringify(draft, null, 2), 'utf8')
  try { unlinkSync(dp) } catch { /* ignore */ }

  return { ok: true, sceneId, choices: draft.choices.length, consequenceKeys: totalKeys }
}

// ── runScriptEnding ──────────────────────────────────────────────

export interface EndingResult {
  ok: true
  endingId: string
}

export interface EndingError {
  ok: false
  error: string
}

export function runScriptEnding(
  skillRoot: string,
  scriptId: string,
  endingId: string,
): EndingResult | EndingError {
  const pPath = planPath(skillRoot, scriptId)
  if (!existsSync(pPath)) return { ok: false, error: 'plan.json not found' }
  let plan: ScriptPlan
  try { plan = JSON.parse(readFileSync(pPath, 'utf8')) }
  catch { return { ok: false, error: 'plan.json is not valid JSON' } }

  // Check ending exists in plan
  const planEnding = plan.endings.find(e => e.id === endingId)
  if (!planEnding) {
    return { ok: false, error: `ending "${endingId}" not found in plan.endings` }
  }

  // Read draft
  const dp = draftPath(skillRoot, scriptId, endingId)
  if (!existsSync(dp)) {
    return { ok: false, error: `draft/${endingId}.json not found` }
  }
  let draft: EndingDraft
  try { draft = JSON.parse(readFileSync(dp, 'utf8')) }
  catch (err) {
    return { ok: false, error: `draft/${endingId}.json JSON error: ${(err as Error).message}` }
  }

  if (!draft.body || draft.body.trim() === '') {
    return { ok: false, error: `ending "${endingId}" body is empty` }
  }

  // Move to endings/
  const dest = endingPath(skillRoot, scriptId, endingId)
  mkdirSync(dirname(dest), { recursive: true })
  renameSync(dp, dest)

  return { ok: true, endingId }
}

// ── runScriptBuild ───────────────────────────────────────────────

export interface BuildResult {
  ok: true
  scriptId: string
  scenes: number
  endings: number
  sizeBytes: number
}

export interface BuildError {
  ok: false
  error: string
}

export function runScriptBuild(skillRoot: string, scriptId: string): BuildResult | BuildError {
  const pPath = planPath(skillRoot, scriptId)
  if (!existsSync(pPath)) return { ok: false, error: 'plan.json not found' }
  let plan: ScriptPlan
  try { plan = JSON.parse(readFileSync(pPath, 'utf8')) }
  catch { return { ok: false, error: 'plan.json is not valid JSON' } }

  // Check all scenes exist
  const missingSc: string[] = []
  for (const sid of Object.keys(plan.scenes)) {
    if (!existsSync(scenePath(skillRoot, scriptId, sid))) missingSc.push(sid)
  }
  if (missingSc.length > 0) {
    return { ok: false, error: `missing scenes: ${missingSc.join(', ')}` }
  }

  // Check all endings exist
  const missingEnd: string[] = []
  for (const ending of plan.endings) {
    if (!existsSync(endingPath(skillRoot, scriptId, ending.id))) missingEnd.push(ending.id)
  }
  if (missingEnd.length > 0) {
    return { ok: false, error: `missing endings: ${missingEnd.join(', ')}` }
  }

  // Assemble final script (same format as current script.json)
  const scenes: Record<string, unknown> = {}
  for (const sid of Object.keys(plan.scenes)) {
    const sceneData = JSON.parse(readFileSync(scenePath(skillRoot, scriptId, sid), 'utf8'))
    scenes[sid] = sceneData
  }

  const endings: unknown[] = []
  for (const pe of plan.endings) {
    const endingData = JSON.parse(readFileSync(endingPath(skillRoot, scriptId, pe.id), 'utf8'))
    endings.push(endingData)
  }

  const finalScript = {
    id: plan.id,
    state_schema: plan.state_schema,
    initial_state: plan.initial_state,
    scenes,
    endings,
  }

  const json = JSON.stringify(finalScript, null, 2)
  const outPath = join(skillRoot, 'runtime', 'scripts', `script-${scriptId}.json`)
  mkdirSync(dirname(outPath), { recursive: true })
  writeFileSync(outPath, json, 'utf8')

  // Cleanup build dir
  const bd = buildDir(skillRoot, scriptId)
  rmSync(bd, { recursive: true, force: true })

  return { ok: true, scriptId, scenes: Object.keys(scenes).length, endings: endings.length, sizeBytes: json.length }
}

// ── runScriptClean ───────────────────────────────────────────────

export interface CleanResult {
  ok: true
  scriptId: string
  draftsRemoved: number
  scriptPreserved: string | null
}

/**
 * Wipe the `.build-<scriptId>/` directory (plan.json + drafts + scenes/
 * endings/). Preserves `runtime/scripts/script-<scriptId>.json` (the final
 * merged product, if any). Idempotent — safe to run when nothing is there.
 *
 * Motivation: when a Phase 1 generation is abandoned mid-flight (for example
 * after several plan iterations), `.build-<id>/` accumulates stale drafts.
 * Successful `runScriptBuild` already removes it; this exposes the cleanup
 * as an explicit command.
 */
export function runScriptClean(skillRoot: string, scriptId: string): CleanResult {
  const bd = buildDir(skillRoot, scriptId)
  let draftsRemoved = 0
  if (existsSync(bd)) {
    const walk = (dir: string): void => {
      for (const entry of readdirSync(dir)) {
        const abs = join(dir, entry)
        const s = statSync(abs)
        if (s.isDirectory()) walk(abs)
        else draftsRemoved++
      }
    }
    walk(bd)
    rmSync(bd, { recursive: true, force: true })
  }

  const finalPath = join(skillRoot, 'runtime', 'scripts', `script-${scriptId}.json`)
  const scriptPreserved = existsSync(finalPath) ? finalPath : null

  return { ok: true, scriptId, draftsRemoved, scriptPreserved }
}
