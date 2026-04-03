import fs from 'node:fs'
import path from 'node:path'
import { PNG } from 'pngjs'
import pixelmatch from 'pixelmatch'

const BASELINES_DIR = path.join(import.meta.dirname, '__baselines__')

export interface CompareResult {
  match: boolean
  diffPixels: number
  totalPixels: number
  diffPercent: number
  diffImagePath?: string
}

export function compareScreenshot(
  screenshotBuffer: Buffer,
  baselineName: string,
  threshold = 0.1,
): CompareResult {
  const baselinePath = path.join(BASELINES_DIR, `${baselineName}.png`)

  // If updating baselines, save and pass
  if (process.env.SOULKILLER_UPDATE_BASELINES) {
    if (!fs.existsSync(BASELINES_DIR)) {
      fs.mkdirSync(BASELINES_DIR, { recursive: true })
    }
    fs.writeFileSync(baselinePath, screenshotBuffer)
    return { match: true, diffPixels: 0, totalPixels: 0, diffPercent: 0 }
  }

  // If no baseline exists, create it
  if (!fs.existsSync(baselinePath)) {
    if (!fs.existsSync(BASELINES_DIR)) {
      fs.mkdirSync(BASELINES_DIR, { recursive: true })
    }
    fs.writeFileSync(baselinePath, screenshotBuffer)
    return { match: true, diffPixels: 0, totalPixels: 0, diffPercent: 0 }
  }

  // Compare
  const baseline = PNG.sync.read(fs.readFileSync(baselinePath))
  const current = PNG.sync.read(screenshotBuffer)

  const { width, height } = baseline
  if (current.width !== width || current.height !== height) {
    return {
      match: false,
      diffPixels: width * height,
      totalPixels: width * height,
      diffPercent: 100,
    }
  }

  const diff = new PNG({ width, height })
  const diffPixels = pixelmatch(
    baseline.data,
    current.data,
    diff.data,
    width,
    height,
    { threshold },
  )

  const totalPixels = width * height
  const diffPercent = (diffPixels / totalPixels) * 100

  const result: CompareResult = {
    match: diffPercent < 1, // Less than 1% difference
    diffPixels,
    totalPixels,
    diffPercent,
  }

  // Save diff image on failure
  if (!result.match) {
    const diffPath = path.join(BASELINES_DIR, `${baselineName}.diff.png`)
    fs.writeFileSync(diffPath, PNG.sync.write(diff))
    result.diffImagePath = diffPath
  }

  return result
}
