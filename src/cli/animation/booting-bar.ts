/**
 * Generate a "BOOTING..." highlight bar with ANSI TrueColor gradient background.
 * Gradient: #440011 → #FF3333 → #FFAAAA → #FF3333 → #440011
 */
export function bootingBar(text: string, width: number): string {
  const RESET = '\x1b[0m'

  // Gradient stops: position (0-1), [r, g, b]
  const stops: [number, [number, number, number]][] = [
    [0.0, [0x44, 0x00, 0x11]],
    [0.25, [0xFF, 0x33, 0x33]],
    [0.5, [0xFF, 0xAA, 0xAA]],
    [0.75, [0xFF, 0x33, 0x33]],
    [1.0, [0x44, 0x00, 0x11]],
  ]

  function interpolate(t: number): [number, number, number] {
    // Find surrounding stops
    for (let i = 0; i < stops.length - 1; i++) {
      const [t0, c0] = stops[i]!
      const [t1, c1] = stops[i + 1]!
      if (t >= t0 && t <= t1) {
        const local = (t - t0) / (t1 - t0)
        return [
          Math.round(c0[0] + (c1[0] - c0[0]) * local),
          Math.round(c0[1] + (c1[1] - c0[1]) * local),
          Math.round(c0[2] + (c1[2] - c0[2]) * local),
        ]
      }
    }
    return stops[stops.length - 1]![1]
  }

  // Pad text to fill the width
  const padded = (' ' + text).padEnd(width)
  let result = ''

  for (let i = 0; i < width; i++) {
    const t = width > 1 ? i / (width - 1) : 0.5
    const [r, g, b] = interpolate(t)
    const char = i < padded.length ? padded[i] : ' '
    // Dark foreground for readability on bright center, light on dark edges
    const brightness = (r + g + b) / 3
    const fg = brightness > 150 ? '\x1b[38;2;20;0;5m' : '\x1b[38;2;255;170;170m'
    result += `\x1b[48;2;${r};${g};${b}m${fg}${char}`
  }

  return result + RESET
}
