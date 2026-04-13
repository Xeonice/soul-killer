import { COLORS } from '../../shared/theme'

interface TooltipProps {
  visible: boolean
  x: number
  y: number
  sceneId: string
  text: string
  status: 'visited' | 'current' | 'unexplored'
}

export function Tooltip({ visible, x, y, sceneId, text, status }: TooltipProps) {
  if (!visible) return null

  const statusLabel = status === 'current' ? 'CURRENT POSITION' : status === 'visited' ? 'VISITED' : 'UNEXPLORED'

  return (
    <div style={{
      position: 'fixed', left: x + 16, top: y + 16,
      background: 'rgba(18,18,26,0.97)', border: `1px solid ${COLORS.cyan}33`,
      borderRadius: 6, padding: '12px 16px', fontSize: 12,
      maxWidth: 320, zIndex: 200, pointerEvents: 'none',
      backdropFilter: 'blur(8px)',
    }}>
      <div style={{ color: COLORS.cyan, marginBottom: 4 }}>{sceneId}</div>
      <div style={{ color: '#999', lineHeight: 1.5 }}>{text}</div>
      <div style={{ color: COLORS.textMuted, marginTop: 8, fontSize: 11 }}>
        Status: <span style={{ color: COLORS.warning }}>{statusLabel}</span>
      </div>
    </div>
  )
}
