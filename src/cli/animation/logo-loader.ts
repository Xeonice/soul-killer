import logoAns from '../../../assets/logo-red-130-r08.ans' with { type: 'text' }
import { primary } from './colors.js'

const FALLBACK_LOGO = [
  '',
  primary('  ╔═══════════════════════════════════════════╗'),
  primary('  ║                                           ║'),
  primary('  ║              A R A S A K A                ║'),
  primary('  ║                                           ║'),
  primary('  ╚═══════════════════════════════════════════╝'),
  '',
]

/**
 * Load the ANSI art Arasaka logo.
 * The logo is embedded at compile time via Bun text import — no runtime filesystem access.
 * Falls back to simple text if terminal is too narrow.
 *
 * The ANS logo is designed for a 130-column canvas with internal spacing that centers
 * the graphic within that canvas. Callers should render it in a plain left-aligned
 * Box of width=contentWidth (no alignItems="center") to preserve the design intent.
 */
export function loadArasakaLogo(terminalWidth?: number): string[] {
  const width = terminalWidth ?? process.stdout.columns ?? 80

  if (width < 130) {
    return FALLBACK_LOGO
  }

  const lines = logoAns.split('\n')
  // Remove trailing empty line if present
  if (lines.length > 0 && lines[lines.length - 1] === '') {
    lines.pop()
  }
  return lines
}
