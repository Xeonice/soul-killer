import type { TreeData, Position, Edge } from './types'
import { COL_W, ROW_H } from './types'

/**
 * BFS-based tree layout algorithm.
 * Returns node positions and edges for rendering.
 */
export function computeLayout(data: TreeData): {
  positions: Record<string, Position>
  edges: Edge[]
} {
  const { scenes, history, endings } = data
  const historySet = new Set(history)
  const positions: Record<string, Position> = {}
  const edges: Edge[] = []
  const colSlots: Record<number, number> = {}
  const laid = new Set<string>()

  const firstSceneId = Object.keys(scenes)[0]
  if (!firstSceneId) return { positions, edges }

  const queue: Array<{ id: string; depth: number }> = [{ id: firstSceneId, depth: 0 }]

  while (queue.length > 0) {
    const { id, depth } = queue.shift()!
    if (laid.has(id)) continue
    laid.add(id)
    if (!colSlots[depth]) colSlots[depth] = 0
    positions[id] = { x: 60 + depth * COL_W, y: 60 + colSlots[depth] * ROW_H, depth }
    colSlots[depth]++

    const scene = scenes[id]
    if (!scene) continue

    for (const choice of scene.choices) {
      if (choice.next) {
        edges.push({
          from: id,
          to: choice.next,
          choiceId: choice.id,
          chosen: historySet.has(`${id}:${choice.id}`),
        })
        if (!laid.has(choice.next)) queue.push({ id: choice.next, depth: depth + 1 })
      }
    }

    if (scene.type === 'affinity_gate' && scene.routing) {
      for (const r of scene.routing) {
        if (r.next) {
          edges.push({ from: id, to: r.next, routeId: r.route_id, isRouting: true, chosen: false })
          if (!laid.has(r.next)) queue.push({ id: r.next, depth: depth + 1 })
        }
      }
    }
  }

  // Position ending nodes
  if (endings) {
    for (const eid of Object.keys(endings)) {
      if (!laid.has(eid)) {
        const incomingEdges = edges.filter((e) => e.to === eid)
        const d =
          incomingEdges.length > 0
            ? Math.max(...incomingEdges.map((e) => (positions[e.from]?.depth ?? 0) + 1))
            : 5
        if (!colSlots[d]) colSlots[d] = 0
        positions[eid] = { x: 60 + d * COL_W, y: 60 + colSlots[d] * ROW_H, depth: d }
        colSlots[d]++
        laid.add(eid)
      }
    }
  }

  return { positions, edges }
}
