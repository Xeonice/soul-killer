import { describe, it, expect } from 'vitest'
import {
  countMdFilesInMap,
  estimateMdTextSizeKb,
} from '../../../src/export/packager.js'

/**
 * Coverage for the runtime-exclusion helpers used by Phase 1 full-read
 * budget anchors. Any entry under `runtime/` — regardless of extension —
 * must not inflate the creative md count or text size.
 *
 * (The former `injectRuntimeFiles` tests were deleted in the
 * skill-binary-contract change; runtime/lib/ is no longer shipped inside
 * archives. See tests/unit/export/packager-contract.test.ts for the
 * whitelist enforcement.)
 */

describe('countMdFilesInMap — runtime exclusion', () => {
  it('excludes every runtime/ entry regardless of extension', () => {
    const files: Record<string, Uint8Array> = {
      'SKILL.md': new Uint8Array(100),
      'souls/judy/identity.md': new Uint8Array(200),
      'souls/judy/style.md': new Uint8Array(300),
      'story-spec.md': new Uint8Array(400),
      // Runtime-owned files (binary writes these at skill runtime) — excluded from budget
      'runtime/engine.md': new Uint8Array(700),
      'runtime/scripts/.gitkeep': new Uint8Array(0),
      // Hypothetical .md under runtime/ — still excluded
      'runtime/scripts/README.md': new Uint8Array(900),
    }
    expect(countMdFilesInMap(files)).toBe(4)
  })

  it('excludes runtime/ from size estimate', () => {
    const files: Record<string, Uint8Array> = {
      'SKILL.md': new Uint8Array(1024),
      'souls/judy/identity.md': new Uint8Array(2048),
      // 10 KB of runtime md — should not contribute to budget
      'runtime/engine.md': new Uint8Array(10240),
    }
    // (1024 + 2048) / 1024 = 3 KB
    expect(estimateMdTextSizeKb(files)).toBe(3)
  })
})
