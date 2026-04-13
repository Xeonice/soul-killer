import { COLORS, STATUS_COLORS, ROUTE_COLORS } from '../../shared/theme'

interface LegendProps {
  routes: string[]
}

export function Legend({ routes }: LegendProps) {
  return (
    <div style={{
      position: 'fixed', bottom: 20, left: '50%', transform: 'translateX(-50%)',
      background: 'rgba(18,18,26,0.95)', border: `1px solid ${COLORS.border}`,
      borderRadius: 8, padding: '10px 20px',
      display: 'flex', gap: 24, fontSize: 12, zIndex: 100,
      backdropFilter: 'blur(8px)',
    }}>
      <LegendItem color={STATUS_COLORS.visited} label="Visited" />
      <LegendItem color={STATUS_COLORS.current} label="Current" />
      <LegendItem color={STATUS_COLORS.unexplored} label="Unexplored" border />
      <LegendItem color={STATUS_COLORS.chosen} label="Your choice" />
      <LegendItem label="Gate" gate />
      {routes.map((r, i) => {
        const color = ROUTE_COLORS[`route_${i}`] ?? ROUTE_COLORS.common
        return <LegendItem key={r} color={color} label={r} />
      })}
    </div>
  )
}

function LegendItem({ color, label, border, gate }: { color?: string; label: string; border?: boolean; gate?: boolean }) {
  const dotStyle: React.CSSProperties = gate
    ? {
        width: 12, height: 12, borderRadius: 0,
        border: `2px dashed ${COLORS.warning}`,
        clipPath: 'polygon(50% 0%, 100% 50%, 50% 100%, 0% 50%)',
        background: 'none',
      }
    : {
        width: 10, height: 10, borderRadius: '50%',
        background: color,
        boxShadow: !border ? `0 0 6px ${color}66` : 'none',
        ...(border && { border: '1px solid #555' }),
      }

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      <div style={dotStyle} />
      {label}
    </div>
  )
}
