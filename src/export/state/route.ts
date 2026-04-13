/**
 * `state route <script-id> <gate-scene-id>`
 *
 * Evaluates an affinity_gate scene's routing conditions against current state.
 * Outputs the matched route and next scene. Writes current_route to meta.yaml.
 */

import { loadScriptFile } from './script.js'
import {
  resolveSavePaths,
  resolveScriptPath,
  readStateFile,
  readMetaFile,
  atomicWrite,
  serializeMetaFile,
  type MetaFile,
} from './io.js'
import type { StateRecord } from './schema.js'

// ── Condition DSL evaluator ─────────────────────────────────────
// Reusable: same DSL as ending conditions.

export interface ComparisonNode {
  key: string
  op: string
  value: unknown
}

export interface BooleanNode {
  all_of?: ConditionNode[]
  any_of?: ConditionNode[]
  not?: ConditionNode
}

export type ConditionNode = ComparisonNode | BooleanNode | 'default'

function isComparison(node: unknown): node is ComparisonNode {
  return typeof node === 'object' && node !== null && 'key' in node && 'op' in node
}

function isBoolean(node: unknown): node is BooleanNode {
  return typeof node === 'object' && node !== null && ('all_of' in node || 'any_of' in node || 'not' in node)
}

export function evaluateCondition(condition: ConditionNode, state: StateRecord): boolean {
  if (condition === 'default') return true

  if (isComparison(condition)) {
    const actual = state[condition.key]
    const expected = condition.value
    if (actual === undefined) return false

    switch (condition.op) {
      case '>=': return typeof actual === 'number' && typeof expected === 'number' && actual >= expected
      case '<=': return typeof actual === 'number' && typeof expected === 'number' && actual <= expected
      case '>': return typeof actual === 'number' && typeof expected === 'number' && actual > expected
      case '<': return typeof actual === 'number' && typeof expected === 'number' && actual < expected
      case '==': return actual === expected
      case '!=': return actual !== expected
      default: return false
    }
  }

  if (isBoolean(condition)) {
    if (condition.all_of) {
      return condition.all_of.every((c) => evaluateCondition(c as ConditionNode, state))
    }
    if (condition.any_of) {
      return condition.any_of.some((c) => evaluateCondition(c as ConditionNode, state))
    }
    if (condition.not) {
      return !evaluateCondition(condition.not as ConditionNode, state)
    }
  }

  return false
}

// ── Route command ────────────────────────────────────────────────

export interface RoutingEntry {
  route_id: string
  condition: unknown
  next: string
}

export interface RouteResult {
  ok: true
  routeId: string
  nextScene: string
}

export interface RouteError {
  ok: false
  error: string
}

export function runRoute(
  skillRoot: string,
  scriptId: string,
  gateSceneId: string,
): RouteResult | RouteError {
  const scriptPath = resolveScriptPath(skillRoot, scriptId)
  const script = loadScriptFile(scriptPath)
  const paths = resolveSavePaths(skillRoot, scriptId, 'auto')
  const meta = readMetaFile(paths.metaYamlPath)
  const parsedState = readStateFile(paths.stateYamlPath)

  // Get the gate scene from raw script data (scenes may not have 'routing' in ParsedScript)
  const rawScenes = (script.raw as Record<string, unknown>).scenes as Record<string, unknown> | undefined
  if (!rawScenes) {
    return { ok: false, error: 'script has no scenes' }
  }
  const gateScene = rawScenes[gateSceneId] as Record<string, unknown> | undefined
  if (!gateScene) {
    return { ok: false, error: `gate scene "${gateSceneId}" not found` }
  }
  if (gateScene.type !== 'affinity_gate') {
    return { ok: false, error: `scene "${gateSceneId}" is not an affinity_gate (type: ${gateScene.type ?? 'undefined'})` }
  }

  const routing = gateScene.routing as RoutingEntry[] | undefined
  if (!Array.isArray(routing) || routing.length === 0) {
    return { ok: false, error: `gate scene "${gateSceneId}" has no routing entries` }
  }

  // Evaluate conditions in order
  for (const entry of routing) {
    if (evaluateCondition(entry.condition as ConditionNode, parsedState.state)) {
      // Write current_route to meta
      const newMeta: MetaFile = {
        scriptRef: meta.scriptRef,
        currentScene: entry.next,
        lastPlayedAt: new Date().toISOString(),
        currentRoute: entry.route_id,
      }
      atomicWrite(paths.metaYamlPath, serializeMetaFile(newMeta))

      return { ok: true, routeId: entry.route_id, nextScene: entry.next }
    }
  }

  // Should not reach here if routing has a default, but just in case
  return { ok: false, error: 'no routing condition matched (missing default?)' }
}
