import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { Layout } from '../../shared/Layout'
import { useSSE } from '../../shared/hooks/useSSE'
import { COLORS, ROUTE_COLORS } from '../../shared/theme'
import { SceneNode, getRouteColor } from './SceneNode'
import { StatsPanel } from './StatsPanel'
import { Legend } from './Legend'
import { Tooltip } from './Tooltip'
import { computeLayout } from './layout'
import type { TreeData } from './types'
import { NODE_W, GATE_W, GATE_CY, NODE_CY } from './types'

export function TreeView() {
  const [data, setData] = useState<TreeData | null>(null)
  const [tooltip, setTooltip] = useState({ visible: false, x: 0, y: 0, sceneId: '', text: '', status: 'unexplored' as const })
  const wrapRef = useRef<HTMLDivElement>(null)
  const panRef = useRef({ isPanning: false, startX: 0, startY: 0, scrollX: 0, scrollY: 0 })

  // Initial data load
  useEffect(() => {
    fetch('/api/data').then((r) => r.json()).then(setData).catch(() => {})
  }, [])

  // SSE real-time updates
  useSSE('/api/events', useMemo(() => ({
    update: (d: unknown) => setData(d as TreeData),
    switch: (d: unknown) => setData(d as TreeData),
  }), []))

  // Pan handlers
  const onMouseDown = useCallback((e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('[data-scene-node]')) return
    const wrap = wrapRef.current
    if (!wrap) return
    panRef.current = { isPanning: true, startX: e.clientX, startY: e.clientY, scrollX: wrap.scrollLeft, scrollY: wrap.scrollTop }
  }, [])

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      const p = panRef.current
      if (!p.isPanning || !wrapRef.current) return
      wrapRef.current.scrollLeft = p.scrollX - (e.clientX - p.startX)
      wrapRef.current.scrollTop = p.scrollY - (e.clientY - p.startY)
    }
    const onUp = () => { panRef.current.isPanning = false }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
    return () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp) }
  }, [])

  // Scroll to current scene on data change
  useEffect(() => {
    if (!data || !wrapRef.current) return
    const { positions } = computeLayout(data)
    const pos = positions[data.currentScene]
    if (pos) {
      const wrap = wrapRef.current
      wrap.scrollTo({
        left: pos.x - wrap.clientWidth / 2 + NODE_W / 2,
        top: pos.y - wrap.clientHeight / 2 + 50,
        behavior: 'smooth',
      })
    }
  }, [data?.currentScene])

  if (!data) {
    return (
      <Layout title="Soulkiller Branch Tree">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: COLORS.primary, fontSize: 14 }}>
          Loading...
        </div>
      </Layout>
    )
  }

  const { scenes, history, currentScene, endings, scriptId, routes, gateScenes } = data
  const historySet = new Set(history)
  const visitedScenes = new Set(history.map((h) => h.split(':')[0]))
  visitedScenes.add(currentScene)

  const { positions, edges } = computeLayout(data)
  const gateSet = new Set(gateScenes ?? [])

  // Canvas size
  let maxX = 0, maxY = 0
  for (const pos of Object.values(positions)) {
    maxX = Math.max(maxX, pos.x + NODE_W + 60)
    maxY = Math.max(maxY, pos.y + 140)
  }

  // Stats
  const totalScenes = Object.keys(scenes).length
  const explored = Object.keys(scenes).filter((s) => visitedScenes.has(s)).length
  const endingsTotal = endings ? Object.keys(endings).length : 0
  const endingsFound = endings ? Object.keys(endings).filter((e) => visitedScenes.has(e)).length : 0

  const headerInfo = (
    <>Script: <span style={{ color: COLORS.primary }}>{scriptId}</span> | Current: <span style={{ color: COLORS.primary }}>{currentScene}</span> | Steps: <span style={{ color: COLORS.primary }}>{history.length}</span></>
  )

  return (
    <Layout title="Soulkiller Branch Tree" info={headerInfo}>
      <div
        ref={wrapRef}
        onMouseDown={onMouseDown}
        style={{ width: '100%', height: '100%', overflow: 'auto', cursor: panRef.current.isPanning ? 'grabbing' : 'grab' }}
      >
        <div style={{ position: 'relative', minWidth: '100%', minHeight: '100%', width: maxX, height: maxY, padding: 60 }}>
          {/* SVG edges */}
          <svg style={{ position: 'absolute', top: 0, left: 0, pointerEvents: 'none' }} width={maxX} height={maxY}>
            {edges.map((edge, i) => {
              const from = positions[edge.from]
              const to = positions[edge.to]
              if (!from || !to) return null

              const fromScene = scenes[edge.from]
              const toScene = scenes[edge.to]
              const fromIsGate = fromScene?.type === 'affinity_gate'
              const toIsGate = toScene?.type === 'affinity_gate'

              const x1 = from.x + (fromIsGate ? GATE_W : NODE_W)
              const y1 = from.y + (fromIsGate ? GATE_CY : NODE_CY)
              const x2 = to.x
              const y2 = to.y + (toIsGate ? GATE_CY : NODE_CY)

              let color: string, opacity: number, width: number
              if (edge.isRouting) {
                const rIdx = routes.indexOf(edge.routeId!)
                color = rIdx >= 0 && rIdx <= 3 ? (ROUTE_COLORS[`route_${rIdx}`] ?? COLORS.warning) : COLORS.warning
                opacity = 0.7; width = 2
              } else {
                color = edge.chosen ? COLORS.magenta : COLORS.border
                opacity = edge.chosen ? 0.8 : 0.4
                width = edge.chosen ? 2 : 1
              }

              const midX = (x1 + x2) / 2
              let d: string
              if (from.depth >= (positions[edge.to]?.depth ?? 0)) {
                const cy = Math.min(y1, y2) - 40
                d = `M ${x1} ${y1} C ${x1 + 60} ${cy}, ${x2 - 60} ${cy}, ${x2} ${y2}`
              } else {
                d = `M ${x1} ${y1} C ${midX} ${y1}, ${midX} ${y2}, ${x2} ${y2}`
              }

              return (
                <g key={i}>
                  <path
                    d={d} fill="none" stroke={color}
                    strokeWidth={width} opacity={opacity}
                    strokeDasharray={edge.isRouting ? '8 4' : undefined}
                    filter={edge.chosen ? 'drop-shadow(0 0 4px rgba(237,30,121,0.3))' : undefined}
                  />
                  <circle cx={x2 - 2} cy={y2} r={3} fill={color} opacity={opacity} />
                </g>
              )
            })}
          </svg>

          {/* Scene nodes */}
          {Object.entries(positions).map(([id, pos]) => {
            const scene = scenes[id]
            const ending = endings?.[id]
            const isVisited = visitedScenes.has(id)
            const isCurrent = id === currentScene
            const status = isCurrent ? 'current' as const : isVisited ? 'visited' as const : 'unexplored' as const
            const isGate = gateSet.has(id) || scene?.type === 'affinity_gate'
            const routeColor = getRouteColor(scene, routes ?? [])

            return (
              <SceneNode
                key={id}
                id={id} x={pos.x} y={pos.y}
                scene={scene} ending={ending}
                status={status} isGate={isGate} routeColor={routeColor}
                historySet={historySet}
                onHover={(nodeId, e) => {
                  const text = ending ? `Ending: ${ending.text}` : (scene?.text ?? '')
                  setTooltip({ visible: true, x: e.clientX, y: e.clientY, sceneId: nodeId, text, status })
                }}
                onMove={(e) => setTooltip((prev) => ({ ...prev, x: e.clientX, y: e.clientY }))}
                onLeave={() => setTooltip((prev) => ({ ...prev, visible: false }))}
              />
            )
          })}
        </div>
      </div>

      <StatsPanel
        totalScenes={totalScenes} explored={explored}
        choicesMade={history.length}
        endingsTotal={endingsTotal} endingsFound={endingsFound}
      />
      <Legend routes={routes ?? []} />
      <Tooltip {...tooltip} />
    </Layout>
  )
}
