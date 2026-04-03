import { readFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
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
 * Load the ANSI art Arasaka logo from assets.
 * Returns an array of pre-colored strings (one per line).
 * Falls back to simple text if file is missing or terminal is too narrow.
 */
export function loadArasakaLogo(terminalWidth?: number): string[] {
  const width = terminalWidth ?? process.stdout.columns ?? 80

  if (width < 130) {
    return FALLBACK_LOGO
  }

  try {
    const __dirname = dirname(fileURLToPath(import.meta.url))
    const logoPath = join(__dirname, '..', '..', '..', 'assets', 'logo-red-130-r08.ans')
    const content = readFileSync(logoPath, 'utf-8')
    const lines = content.split('\n')
    // Remove trailing empty line if present
    if (lines.length > 0 && lines[lines.length - 1] === '') {
      lines.pop()
    }
    return lines
  } catch {
    return FALLBACK_LOGO
  }
}
