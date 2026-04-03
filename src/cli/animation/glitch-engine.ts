const GLITCH_CHARS = '░▒▓█▀▄▌▐─│┌┐└┘├┤┬┴┼'
const HEX_CHARS = '0123456789ABCDEF'

/**
 * Seeded PRNG (mulberry32) for reproducible glitch effects.
 * When SOULKILLER_SEED is set, glitch output is deterministic.
 */
function mulberry32(seed: number): () => number {
  return () => {
    seed |= 0
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export class GlitchEngine {
  private rng: () => number

  constructor(seed?: number) {
    const envSeed = process.env.SOULKILLER_SEED
    const resolvedSeed = seed ?? (envSeed ? parseInt(envSeed, 10) : undefined)
    this.rng = resolvedSeed !== undefined ? mulberry32(resolvedSeed) : Math.random
  }

  /** Get a random number [0, 1) */
  random(): number {
    return this.rng()
  }

  /** Get a random integer [0, max) */
  randomInt(max: number): number {
    return Math.floor(this.rng() * max)
  }

  /** Pick a random element from an array */
  pick<T>(arr: readonly T[]): T {
    return arr[this.randomInt(arr.length)]!
  }

  /** Get a random glitch character */
  glitchChar(): string {
    return GLITCH_CHARS[this.randomInt(GLITCH_CHARS.length)]!
  }

  /** Get a random hex pair like "1C", "E9" */
  hexPair(): string {
    return HEX_CHARS[this.randomInt(16)]! + HEX_CHARS[this.randomInt(16)]!
  }

  /**
   * Apply glitch effect to text.
   * @param text - Source text
   * @param intensity - 0.0 (no glitch) to 1.0 (fully glitched)
   * @returns Glitched text
   */
  glitchText(text: string, intensity: number): string {
    const chars = [...text]
    for (let i = 0; i < chars.length; i++) {
      if (chars[i] === '\n' || chars[i] === ' ') continue
      if (this.rng() < intensity) {
        chars[i] = this.glitchChar()
      }
    }
    return chars.join('')
  }

  /**
   * Generate a hex matrix line (like Breach Protocol grid).
   * @param width - Number of hex pairs
   */
  hexMatrixLine(width: number): string {
    const pairs: string[] = []
    for (let i = 0; i < width; i++) {
      pairs.push(this.hexPair())
    }
    return pairs.join(' ')
  }

  /**
   * Progressively reveal text from glitch to clear.
   * Returns a function that takes progress (0-1) and returns the current frame.
   */
  revealSequence(finalText: string): (progress: number) => string {
    return (progress: number) => {
      const intensity = 1 - Math.min(1, Math.max(0, progress))
      return this.glitchText(finalText, intensity)
    }
  }
}

// Shared global instance
let _instance: GlitchEngine | undefined

export function getGlitchEngine(): GlitchEngine {
  if (!_instance) {
    _instance = new GlitchEngine()
  }
  return _instance
}

/** Reset the singleton (for testing — forces re-read of SOULKILLER_SEED). */
export function resetGlitchEngine(): void {
  _instance = undefined
}
