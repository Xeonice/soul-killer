/** Cyberpunk color palette — synced from src/cli/animation/colors.ts */
export const COLORS = {
  primary: '#FF3333',
  accent: '#FFAAAA',
  dim: '#CC4444',
  dark: '#440011',
  warning: '#F3E600',
  bg: '#080808',
  bgSurface: '#12121a',
  bgHover: '#ffffff08',
  border: '#1a1a2e',
  text: '#c0c0c0',
  textBright: '#e0e0e0',
  textMuted: '#666',
  textDim: '#888',
  cyan: '#00f7ff',
  magenta: '#ed1e79',
} as const

export const ROUTE_COLORS: Record<string, string> = {
  common: COLORS.text,
  route_0: COLORS.cyan,
  route_1: COLORS.magenta,
  route_2: COLORS.warning,
  route_3: '#00ff88',
}

export const STATUS_COLORS = {
  visited: COLORS.cyan,
  current: COLORS.warning,
  unexplored: '#333',
  chosen: COLORS.magenta,
} as const
