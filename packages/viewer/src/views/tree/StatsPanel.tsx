import { COLORS } from '../../shared/theme'

interface StatsPanelProps {
  totalScenes: number
  explored: number
  choicesMade: number
  endingsTotal: number
  endingsFound: number
}

export function StatsPanel({ totalScenes, explored, choicesMade, endingsTotal, endingsFound }: StatsPanelProps) {
  const pct = totalScenes > 0 ? Math.round((explored / totalScenes) * 100) : 0

  return (
    <div style={{
      position: 'fixed', top: 70, right: 20,
      background: `rgba(18,18,26,0.95)`, border: `1px solid ${COLORS.border}`,
      borderRadius: 8, padding: 16, fontSize: 12, zIndex: 100, minWidth: 180,
    }}>
      <div style={{ color: COLORS.primary, fontSize: 11, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 12 }}>
        Progress
      </div>
      <Row label="Scenes explored" value={`${explored} / ${totalScenes}`} />
      <Row label="Choices made" value={String(choicesMade)} />
      <Row label="Endings found" value={`${endingsFound} / ${endingsTotal}`} />
      <div style={{ height: 3, background: COLORS.border, borderRadius: 2, marginTop: 12, overflow: 'hidden' }}>
        <div style={{
          height: '100%',
          background: `linear-gradient(90deg, ${COLORS.cyan}, ${COLORS.magenta})`,
          borderRadius: 2,
          width: `${pct}%`,
          transition: 'width 0.5s ease',
        }} />
      </div>
    </div>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6, color: COLORS.textDim }}>
      <span>{label}</span>
      <span style={{ color: COLORS.textBright }}>{value}</span>
    </div>
  )
}
