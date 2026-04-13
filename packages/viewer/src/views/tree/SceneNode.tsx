import { COLORS, ROUTE_COLORS, STATUS_COLORS } from '../../shared/theme'
import type { SceneData, EndingData } from './types'

interface SceneNodeProps {
  id: string
  x: number
  y: number
  scene?: SceneData
  ending?: EndingData
  status: 'visited' | 'current' | 'unexplored'
  isGate: boolean
  routeColor: string
  historySet: Set<string>
  onHover: (id: string, e: React.MouseEvent) => void
  onMove: (e: React.MouseEvent) => void
  onLeave: () => void
}

export function SceneNode({
  id, x, y, scene, ending, status, isGate, routeColor, historySet,
  onHover, onMove, onLeave,
}: SceneNodeProps) {
  const isDefault = routeColor === ROUTE_COLORS.common

  const nodeStyle: React.CSSProperties = {
    position: 'absolute',
    left: x,
    top: y,
    width: isGate ? 160 : 200,
    borderRadius: isGate ? 0 : 6,
    border: isGate ? 'none' : `1px solid ${COLORS.border}`,
    background: COLORS.bgSurface,
    cursor: 'pointer',
    userSelect: 'none',
    opacity: status === 'unexplored' ? 0.45 : 1,
    ...(status === 'current' && { borderColor: COLORS.warning, boxShadow: `0 0 20px rgba(243,230,0,0.15)` }),
    ...(status === 'visited' && !isGate && { borderColor: `${COLORS.cyan}33` }),
    ...(!isDefault && !isGate && { borderColor: `${routeColor}66` }),
    ...(isGate && {
      height: 160,
      clipPath: 'polygon(50% 0%, 100% 50%, 50% 100%, 0% 50%)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      textAlign: 'center' as const,
    }),
  }

  const dotStyle: React.CSSProperties = {
    width: 8, height: 8, borderRadius: '50%', flexShrink: 0,
    background: STATUS_COLORS[status],
    boxShadow: status !== 'unexplored' ? `0 0 4px ${STATUS_COLORS[status]}88` : 'none',
    ...(status === 'unexplored' && { border: '1px solid #555' }),
    ...(!isDefault && { background: routeColor, boxShadow: `0 0 4px ${routeColor}88` }),
  }

  const label = ending ? '[ END ]' : isGate ? '[ GATE ]' : id
  const title = ending
    ? ending.text
    : isGate
      ? (scene?.routing ? `${scene.routing.length} routes` : 'GATE')
      : ((scene?.text?.slice(0, 40) ?? '') + ((scene?.text?.length ?? 0) > 40 ? '...' : ''))

  return (
    <div
      style={nodeStyle}
      onMouseEnter={(e) => onHover(id, e)}
      onMouseMove={onMove}
      onMouseLeave={onLeave}
    >
      {isGate && (
        <div style={{ position: 'absolute', inset: 0, clipPath: 'polygon(50% 0%, 100% 50%, 50% 100%, 0% 50%)', border: `2px dashed ${COLORS.warning}`, boxSizing: 'border-box', pointerEvents: 'none' }} />
      )}
      <div style={{
        padding: '8px 12px',
        borderBottom: isGate ? 'none' : `1px solid ${COLORS.border}`,
        display: 'flex',
        alignItems: isGate ? 'center' : 'center',
        gap: 8,
        ...(isGate && { flexDirection: 'column' as const, gap: 2, padding: 4 }),
      }}>
        <div style={dotStyle} />
        <span style={{ fontSize: 11, color: COLORS.textMuted, flexShrink: 0 }}>{label}</span>
        <span style={{
          fontSize: isGate ? 11 : 12,
          color: COLORS.textBright,
          whiteSpace: isGate ? 'normal' : 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          ...(isGate && { textAlign: 'center' as const }),
        }}>{title}</span>
      </div>

      {!isGate && scene && scene.choices.length > 0 && (
        <div style={{ padding: '6px 0' }}>
          {scene.choices.map((choice, i) => {
            const wasChosen = historySet.has(`${id}:${choice.id}`)
            return (
              <div key={choice.id} style={{
                padding: '4px 12px', fontSize: 11,
                display: 'flex', alignItems: 'center', gap: 6,
                color: wasChosen ? COLORS.magenta : COLORS.textDim,
              }}>
                <span style={{ color: '#555', fontSize: 10, flexShrink: 0, width: 16 }}>
                  {String.fromCharCode(65 + i)}
                </span>
                <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {choice.text}
                </span>
                {wasChosen && <span style={{ color: COLORS.magenta, fontSize: 9, flexShrink: 0 }}>  ★</span>}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

export function getRouteColor(scene: SceneData | undefined, routes: string[]): string {
  if (!scene) return ROUTE_COLORS.common
  if (scene.type === 'affinity_gate') return COLORS.warning
  if (scene.route && routes.length > 0) {
    const idx = routes.indexOf(scene.route)
    if (idx >= 0 && idx <= 3) return ROUTE_COLORS[`route_${idx}`] ?? ROUTE_COLORS.common
    return ROUTE_COLORS.common
  }
  return ROUTE_COLORS.common
}
