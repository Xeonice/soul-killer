import type { ReactNode } from 'react'
import { COLORS } from './theme'

const styles = {
  body: {
    background: COLORS.bg,
    color: COLORS.text,
    fontFamily: "'SF Mono', 'Fira Code', 'Cascadia Code', monospace",
    margin: 0,
    height: '100vh',
    overflow: 'hidden',
    display: 'flex',
    flexDirection: 'column' as const,
  },
  header: {
    background: `linear-gradient(180deg, ${COLORS.bgSurface} 0%, ${COLORS.bg} 100%)`,
    borderBottom: `1px solid ${COLORS.border}`,
    padding: '16px 24px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    userSelect: 'none' as const,
  },
  title: {
    fontSize: 14,
    color: COLORS.primary,
    letterSpacing: 2,
    textTransform: 'uppercase' as const,
  },
  info: {
    fontSize: 12,
    color: COLORS.textMuted,
  },
  content: {
    flex: 1,
    overflow: 'hidden',
  },
}

export function Layout({
  title,
  info,
  children,
}: {
  title: string
  info?: ReactNode
  children: ReactNode
}) {
  return (
    <div style={styles.body}>
      <div style={styles.header}>
        <div style={styles.title}>{title}</div>
        {info && <div style={styles.info}>{info}</div>}
      </div>
      <div style={styles.content}>{children}</div>
    </div>
  )
}
