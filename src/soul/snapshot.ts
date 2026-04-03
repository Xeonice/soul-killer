import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'

const MAX_SNAPSHOTS = 10

export interface SnapshotMeta {
  timestamp: string
  reason: string
  chunk_count_at_time: number
}

export interface SnapshotInfo {
  id: string // timestamp string used as directory name
  meta: SnapshotMeta
  path: string
}

/**
 * Create a snapshot of the soul/ directory before evolve.
 */
export function createSnapshot(soulDir: string, reason: string, chunkCount: number): string {
  const snapshotsDir = path.join(soulDir, 'snapshots')
  const soulFilesDir = path.join(soulDir, 'soul')

  if (!fs.existsSync(soulFilesDir)) {
    throw new Error('No soul files to snapshot')
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-') + '-' + crypto.randomBytes(4).toString('hex')
  const snapshotDir = path.join(snapshotsDir, timestamp)

  // Copy soul/ directory recursively
  fs.cpSync(soulFilesDir, path.join(snapshotDir, 'soul'), { recursive: true })

  // Write snapshot meta
  const meta: SnapshotMeta = {
    timestamp: new Date().toISOString(),
    reason,
    chunk_count_at_time: chunkCount,
  }
  fs.writeFileSync(path.join(snapshotDir, 'snapshot-meta.json'), JSON.stringify(meta, null, 2), 'utf-8')

  // Enforce retention limit
  enforceRetentionLimit(snapshotsDir)

  return timestamp
}

/**
 * List all snapshots for a soul, newest first.
 */
export function listSnapshots(soulDir: string): SnapshotInfo[] {
  const snapshotsDir = path.join(soulDir, 'snapshots')
  if (!fs.existsSync(snapshotsDir)) return []

  const entries = fs.readdirSync(snapshotsDir, { withFileTypes: true })
    .filter((e) => e.isDirectory())
    .map((e) => e.name)
    .sort()
    .reverse()

  const snapshots: SnapshotInfo[] = []
  for (const id of entries) {
    const metaPath = path.join(snapshotsDir, id, 'snapshot-meta.json')
    if (!fs.existsSync(metaPath)) continue

    try {
      const meta = JSON.parse(fs.readFileSync(metaPath, 'utf-8')) as SnapshotMeta
      snapshots.push({
        id,
        meta,
        path: path.join(snapshotsDir, id),
      })
    } catch {
      // Skip corrupted snapshots
    }
  }

  return snapshots
}

/**
 * Restore soul files from a snapshot.
 * Creates a pre-rollback snapshot first to prevent data loss.
 */
export function restoreSnapshot(soulDir: string, snapshotId: string, currentChunkCount: number): void {
  const snapshotDir = path.join(soulDir, 'snapshots', snapshotId)
  const snapshotSoulDir = path.join(snapshotDir, 'soul')
  const liveSoulDir = path.join(soulDir, 'soul')

  if (!fs.existsSync(snapshotSoulDir)) {
    throw new Error(`Snapshot ${snapshotId} does not contain soul files`)
  }

  // Create pre-rollback snapshot (safety net)
  if (fs.existsSync(liveSoulDir)) {
    createSnapshot(soulDir, 'pre-rollback', currentChunkCount)
  }

  // Replace live soul files with snapshot
  if (fs.existsSync(liveSoulDir)) {
    fs.rmSync(liveSoulDir, { recursive: true })
  }
  fs.cpSync(snapshotSoulDir, liveSoulDir, { recursive: true })
}

/**
 * Delete the oldest snapshots to stay within MAX_SNAPSHOTS limit.
 */
function enforceRetentionLimit(snapshotsDir: string): void {
  const entries = fs.readdirSync(snapshotsDir, { withFileTypes: true })
    .filter((e) => e.isDirectory())
    .map((e) => e.name)
    .sort()

  while (entries.length > MAX_SNAPSHOTS) {
    const oldest = entries.shift()!
    fs.rmSync(path.join(snapshotsDir, oldest), { recursive: true })
  }
}
