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

/** Strip ANSI escape sequences to get the visible character width of a string. */
function visibleWidth(str: string): number {
  return str.replace(/\x1b\[[0-9;]*[A-Za-z]/g, '').length
}

/**
 * Load the ANSI art Arasaka logo.
 * The logo is embedded at compile time via Bun text import — no runtime filesystem access.
 * Falls back to simple text if terminal is too narrow.
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

/**
 * Load the logo pre-padded for manual horizontal centering within contentWidth.
 *
 * ink's yoga-layout counts raw string .length (including ANSI escape bytes) when
 * computing alignItems="center" margins, which displaces logo lines to the left.
 * This function strips escapes to get the true visible width, then prepends the
 * correct number of spaces so the caller can render with a plain left-aligned Box.
 */
export function loadArasakaLogoCentered(contentWidth: number): string[] {
  const lines = loadArasakaLogo(contentWidth)
  return lines.map(line => {
    const vw = visibleWidth(line)
    const pad = Math.max(0, Math.floor((contentWidth - vw) / 2))
    return ' '.repeat(pad) + line
  })
}
