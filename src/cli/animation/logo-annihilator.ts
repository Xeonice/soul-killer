import { PRIMARY, DIM, DARK } from './colors.js'

const GLITCH_CHARS = '░▒▓█▀▄▌▐─│┌┐└┘├┤┬┴┼'

/**
 * Multi-layered logo annihilation engine.
 * Phase A: glitch flicker (chars replaced with glitch chars, not removed)
 * Phase B: glitch + dissolution (some replaced, some removed)
 * Phase C: rapid collapse (mass removal)
 */
export class LogoAnnihilator {
  private charPositions: number[][]
  private lines: string[]
  /** State per visible char: 'alive' | 'glitched' | 'dead' */
  private state: ('alive' | 'glitched' | 'dead')[][]
  private totalVisible: number
  private deadCount: number
  private glitchedCount: number

  constructor(lines: string[]) {
    this.lines = lines
    this.charPositions = []
    this.state = []
    this.totalVisible = 0
    this.deadCount = 0
    this.glitchedCount = 0

    for (const line of lines) {
      const positions = findVisiblePositions(line)
      this.charPositions.push(positions)
      this.state.push(positions.map(() => 'alive'))
      this.totalVisible += positions.length
    }
  }

  /**
   * Advance one frame based on progress (0-1).
   * 0-0.25: Phase A — glitch flicker only
   * 0.25-0.65: Phase B — glitch + dissolve
   * 0.65-0.9: Phase C — rapid collapse
   * 0.9-1.0: Phase D — kill remaining
   */
  advanceFrame(progress: number, rng: () => number): void {
    if (progress < 0.25) {
      // Phase A: convert some alive → glitched (flickering)
      this.transitionRandom('alive', 'glitched', 0.04, rng)
      // Some glitched recover back to alive (flickering effect)
      this.transitionRandom('glitched', 'alive', 0.02, rng)
    } else if (progress < 0.65) {
      // Phase B: more glitching + start killing
      this.transitionRandom('alive', 'glitched', 0.06, rng)
      this.transitionRandom('glitched', 'dead', 0.05, rng)
      this.transitionRandom('alive', 'dead', 0.02, rng)
    } else if (progress < 0.9) {
      // Phase C: rapid collapse
      this.transitionRandom('alive', 'dead', 0.08, rng)
      this.transitionRandom('glitched', 'dead', 0.12, rng)
      this.transitionRandom('alive', 'glitched', 0.1, rng)
    } else {
      // Phase D: kill everything remaining
      this.transitionRandom('alive', 'dead', 0.3, rng)
      this.transitionRandom('glitched', 'dead', 0.3, rng)
    }
  }

  private transitionRandom(
    from: 'alive' | 'glitched' | 'dead',
    to: 'alive' | 'glitched' | 'dead',
    percentage: number,
    rng: () => number,
  ): void {
    const candidates: [number, number][] = []
    for (let row = 0; row < this.state.length; row++) {
      for (let col = 0; col < this.state[row]!.length; col++) {
        if (this.state[row]![col] === from) {
          candidates.push([row, col])
        }
      }
    }
    const count = Math.max(1, Math.ceil(candidates.length * percentage))
    // Partial Fisher-Yates
    for (let i = candidates.length - 1; i > 0 && i >= candidates.length - count; i--) {
      const j = Math.floor(rng() * (i + 1))
      ;[candidates[i], candidates[j]] = [candidates[j]!, candidates[i]!]
      const [row, col] = candidates[i]!
      this.state[row]![col] = to
      if (to === 'dead' && from !== 'dead') this.deadCount++
      if (to === 'glitched' && from !== 'glitched') this.glitchedCount++
      if (from === 'glitched' && to !== 'glitched') this.glitchedCount--
      if (from === 'dead' && to !== 'dead') this.deadCount--
    }
  }

  /** Render current state with glitch chars and spaces */
  render(rng: () => number): string[] {
    const result: string[] = []
    for (let row = 0; row < this.lines.length; row++) {
      const line = this.lines[row]!
      const positions = this.charPositions[row]!
      const states = this.state[row]!

      // Build lookup: position → state
      const posState = new Map<number, 'alive' | 'glitched' | 'dead'>()
      for (let i = 0; i < positions.length; i++) {
        posState.set(positions[i]!, states[i]!)
      }

      let output = ''
      let idx = 0
      while (idx < line.length) {
        if (line[idx] === '\x1b') {
          const end = line.indexOf('m', idx)
          if (end !== -1) {
            output += line.slice(idx, end + 1)
            idx = end + 1
          } else {
            output += line[idx]
            idx++
          }
        } else {
          const st = posState.get(idx)
          if (st === 'dead') {
            output += ' '
          } else if (st === 'glitched') {
            output += GLITCH_CHARS[Math.floor(rng() * GLITCH_CHARS.length)]!
          } else {
            output += line[idx]
          }
          idx++
        }
      }
      result.push(output)
    }
    return result
  }

  get dissolvedRatio(): number {
    if (this.totalVisible === 0) return 1
    return this.deadCount / this.totalVisible
  }

  get currentColor(): string {
    const ratio = this.dissolvedRatio
    if (ratio < 0.3) return PRIMARY
    if (ratio < 0.7) return DIM
    return DARK
  }

  get isFullyDissolved(): boolean {
    return this.deadCount >= this.totalVisible
  }
}

function findVisiblePositions(line: string): number[] {
  const positions: number[] = []
  let idx = 0
  while (idx < line.length) {
    if (line[idx] === '\x1b') {
      const end = line.indexOf('m', idx)
      if (end !== -1) {
        idx = end + 1
      } else {
        idx++
      }
    } else {
      if (line[idx] !== ' ') {
        positions.push(idx)
      }
      idx++
    }
  }
  return positions
}
