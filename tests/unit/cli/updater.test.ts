import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { mkdtempSync, writeFileSync, existsSync, readFileSync, rmSync, symlinkSync, realpathSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import {
  atomicReplaceBinary,
  resolveTargetPath,
  reportReplaceFailure,
  type ReplaceFailure,
  type ReplaceOps,
} from '../../../src/cli/updater.js'

function tmp(): string {
  return mkdtempSync(join(tmpdir(), 'soulkiller-updater-'))
}

/**
 * Build a ReplaceOps backed by real fs but with selected operations
 * overridden. Used to simulate targeted failures (e.g. rename throws EBUSY
 * but writeFile still works normally).
 */
function ops(overrides: Partial<ReplaceOps> = {}): ReplaceOps {
  const fs = require('node:fs') as typeof import('node:fs')
  const base: ReplaceOps = {
    rename: (a, b) => fs.renameSync(a, b),
    writeFile: (t, d) => fs.writeFileSync(t, d),
    readFile: (s) => fs.readFileSync(s),
    chmod: (t, m) => fs.chmodSync(t, m),
    exists: (t) => fs.existsSync(t),
    unlink: (t) => fs.unlinkSync(t),
  }
  return { ...base, ...overrides }
}

function errnoError(code: string, msg?: string): NodeJS.ErrnoException {
  const e: NodeJS.ErrnoException = new Error(msg ?? `${code}: simulated`)
  e.code = code
  return e
}

describe('resolveTargetPath', () => {
  let root: string
  beforeEach(() => { root = tmp() })
  afterEach(() => rmSync(root, { recursive: true, force: true }))

  it('returns canonical path for a symlinked file', () => {
    const real = join(root, 'real.bin')
    const link = join(root, 'link.bin')
    writeFileSync(real, 'hello')
    symlinkSync(real, link)
    // macOS tmpdir is under /var which is itself a symlink to /private/var;
    // realpath on the real file resolves that too, so compare via realpath.
    expect(resolveTargetPath(link)).toBe(realpathSync(real))
  })

  it('returns input unchanged when realpath fails (nonexistent path)', () => {
    const ghost = join(root, 'does-not-exist.bin')
    expect(resolveTargetPath(ghost)).toBe(ghost)
  })
})

describe('atomicReplaceBinary — Unix branch', () => {
  let root: string
  beforeEach(() => { root = tmp() })
  afterEach(() => rmSync(root, { recursive: true, force: true }))

  it('renames src onto dst successfully', async () => {
    const src = join(root, 'new.bin')
    const dst = join(root, 'target.bin')
    writeFileSync(src, 'NEW')
    writeFileSync(dst, 'OLD')

    const result = await atomicReplaceBinary(src, dst, 'linux')
    expect(result.ok).toBe(true)
    expect(readFileSync(dst, 'utf8')).toBe('NEW')
    expect(existsSync(src)).toBe(false)
  })

  it('falls back to read+write on EXDEV (cross-device)', async () => {
    const src = join(root, 'new.bin')
    const dst = join(root, 'target.bin')
    writeFileSync(src, 'NEW')
    writeFileSync(dst, 'OLD')

    // First rename fails with EXDEV; subsequent fs calls use real backend.
    let renameCalls = 0
    const result = await atomicReplaceBinary(src, dst, 'linux', ops({
      rename: (from, to) => {
        renameCalls++
        if (renameCalls === 1) throw errnoError('EXDEV', 'cross-device link not permitted')
        require('node:fs').renameSync(from, to)
      },
    }))

    expect(result.ok).toBe(true)
    expect(readFileSync(dst, 'utf8')).toBe('NEW')
  })

  it('classifies EACCES as PERMISSION', async () => {
    const src = join(root, 'new.bin')
    const dst = join(root, 'target.bin')
    writeFileSync(src, 'NEW')
    writeFileSync(dst, 'OLD')

    const result = await atomicReplaceBinary(src, dst, 'linux', ops({
      rename: () => { throw errnoError('EACCES', 'permission denied') },
    }))

    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.reason.code).toBe('PERMISSION')
    // dst must be untouched
    expect(readFileSync(dst, 'utf8')).toBe('OLD')
  })

  it('returns UNKNOWN for unfamiliar errno', async () => {
    const src = join(root, 'new.bin')
    const dst = join(root, 'target.bin')
    writeFileSync(src, 'NEW')
    writeFileSync(dst, 'OLD')

    const result = await atomicReplaceBinary(src, dst, 'linux', ops({
      rename: () => { throw errnoError('EWEIRD', 'unexpected') },
    }))

    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.reason.code).toBe('UNKNOWN')
      expect(result.reason.message).toContain('unexpected')
    }
  })
})

describe('atomicReplaceBinary — Windows branch', () => {
  let root: string
  beforeEach(() => { root = tmp() })
  afterEach(() => rmSync(root, { recursive: true, force: true }))

  it('rename(dst → .old) + write(dst) succeeds and cleans up .old', async () => {
    const src = join(root, 'new.exe')
    const dst = join(root, 'target.exe')
    writeFileSync(src, 'NEW_BINARY')
    writeFileSync(dst, 'OLD_BINARY')

    const result = await atomicReplaceBinary(src, dst, 'win32')
    expect(result.ok).toBe(true)
    expect(readFileSync(dst, 'utf8')).toBe('NEW_BINARY')
    expect(existsSync(dst + '.old')).toBe(false)
  })

  it('clears stale .old before claiming the name', async () => {
    const src = join(root, 'new.exe')
    const dst = join(root, 'target.exe')
    writeFileSync(src, 'NEW_BINARY')
    writeFileSync(dst, 'OLD_BINARY')
    writeFileSync(dst + '.old', 'STALE')

    const result = await atomicReplaceBinary(src, dst, 'win32')
    expect(result.ok).toBe(true)
    expect(readFileSync(dst, 'utf8')).toBe('NEW_BINARY')
  })

  it('rename failure returns LOCKED without touching dst', async () => {
    const src = join(root, 'new.exe')
    const dst = join(root, 'target.exe')
    writeFileSync(src, 'NEW_BINARY')
    writeFileSync(dst, 'OLD_BINARY')

    const result = await atomicReplaceBinary(src, dst, 'win32', ops({
      rename: () => { throw errnoError('EBUSY', 'resource busy or locked') },
    }))

    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.reason.code).toBe('LOCKED')
      expect(result.reason.message).toContain('EBUSY')
    }
    // Original dst contents must be intact (no rename succeeded)
    expect(readFileSync(dst, 'utf8')).toBe('OLD_BINARY')
  })

  it('write failure triggers rollback — dst restored from .old, returns DISK_FULL', async () => {
    const src = join(root, 'new.exe')
    const dst = join(root, 'target.exe')
    writeFileSync(src, 'NEW_BINARY')
    writeFileSync(dst, 'OLD_BINARY')

    const result = await atomicReplaceBinary(src, dst, 'win32', ops({
      // Let rename(dst → .old) succeed, but fail writeFile
      writeFile: () => { throw errnoError('ENOSPC', 'no space left on device') },
    }))

    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.reason.code).toBe('DISK_FULL')
    // Rollback verifies dst back to original contents
    expect(readFileSync(dst, 'utf8')).toBe('OLD_BINARY')
    expect(existsSync(dst + '.old')).toBe(false)
  })

  it('classifies EPERM as LOCKED (Windows file-lock variant)', async () => {
    const src = join(root, 'new.exe')
    const dst = join(root, 'target.exe')
    writeFileSync(src, 'NEW_BINARY')
    writeFileSync(dst, 'OLD_BINARY')

    const result = await atomicReplaceBinary(src, dst, 'win32', ops({
      rename: () => { throw errnoError('EPERM', 'operation not permitted') },
    }))

    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.reason.code).toBe('LOCKED')
  })
})

describe('reportReplaceFailure', () => {
  it.each<[ReplaceFailure['code'], string[]]>([
    ['LOCKED',     ['executable lock', 'Close any open REPL']],
    ['PERMISSION', ['permission denied', process.execPath]],
    ['DISK_FULL',  ['disk full']],
    ['UNKNOWN',    ['update failed']],
  ])('prints user-facing hint for %s', (code, expected) => {
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    try {
      reportReplaceFailure({ code, message: 'some message' } as ReplaceFailure)
      const all = errSpy.mock.calls.map((c: unknown[]) => c.join(' ')).join('\n')
      for (const e of expected) expect(all).toContain(e)
    } finally {
      errSpy.mockRestore()
    }
  })
})
