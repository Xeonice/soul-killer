/**
 * Filesystem IO helpers for skill runtime state files.
 *
 * All writes go through atomicWrite: write to a temp file alongside the
 * target then rename. fs.rename is atomic on POSIX, so a crash anywhere in
 * this sequence leaves the target file in its old state.
 */

import { readFileSync, writeFileSync, renameSync, mkdirSync, existsSync } from 'node:fs'
import { dirname } from 'node:path'
import {
  parseMiniYaml,
  serializeMiniYaml,
  type MiniDocument,
  type MiniBlock,
} from './mini-yaml.js'
import { parseStateFile, type ParsedStateFile, type StateRecord } from './schema.js'

export type SaveType = 'auto' | { manual: string }

export interface SavePaths {
  stateYamlPath: string
  metaYamlPath: string
}

export interface MetaFile {
  scriptRef: string
  currentScene: string
  lastPlayedAt?: string
  currentRoute?: string
}

/**
 * Atomic single-file write: write to `<path>.tmp` then rename to `<path>`.
 * The parent directory is created recursively if missing.
 */
export function atomicWrite(path: string, content: string): void {
  const dir = dirname(path)
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true })
  }
  const tmp = `${path}.tmp.${process.pid}.${Date.now()}`
  writeFileSync(tmp, content, 'utf8')
  renameSync(tmp, path)
}

/**
 * Transactional write of state.yaml + meta.yaml.
 *
 * Both files are written to temp paths first. Only after both temp writes
 * succeed do we rename both into place. If the first rename succeeds and the
 * second fails, we attempt to roll back the first rename (best-effort).
 */
export function writeSaveTransaction(
  paths: SavePaths,
  state: ParsedStateFile,
  meta: MetaFile
): void {
  const stateText = serializeStateFile(state)
  const metaText = serializeMetaFile(meta)

  const dir = dirname(paths.stateYamlPath)
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true })
  }

  const stateTmp = `${paths.stateYamlPath}.tmp.${process.pid}.${Date.now()}`
  const metaTmp = `${paths.metaYamlPath}.tmp.${process.pid}.${Date.now()}`

  writeFileSync(stateTmp, stateText, 'utf8')
  try {
    writeFileSync(metaTmp, metaText, 'utf8')
  } catch (err) {
    safeUnlink(stateTmp)
    throw err
  }

  // Capture old content for rollback (if files already existed)
  const stateOld = existsSync(paths.stateYamlPath)
    ? readFileSync(paths.stateYamlPath, 'utf8')
    : null
  const metaOld = existsSync(paths.metaYamlPath)
    ? readFileSync(paths.metaYamlPath, 'utf8')
    : null

  renameSync(stateTmp, paths.stateYamlPath)
  try {
    renameSync(metaTmp, paths.metaYamlPath)
  } catch (err) {
    // Rollback state.yaml (best-effort)
    if (stateOld !== null) {
      writeFileSync(paths.stateYamlPath, stateOld, 'utf8')
    }
    safeUnlink(metaTmp)
    throw err
  }
  // Suppress unused-var lint for metaOld; rollback path is captured via stateOld only
  void metaOld
}

function safeUnlink(path: string): void {
  try {
    const { unlinkSync } = require('node:fs') as typeof import('node:fs')
    unlinkSync(path)
  } catch {
    // ignore
  }
}

export function readStateFile(path: string): ParsedStateFile {
  const text = readFileSync(path, 'utf8')
  return parseStateFile(text)
}

export function readMetaFile(path: string): MetaFile {
  const text = readFileSync(path, 'utf8')
  const doc = parseMiniYaml(text)
  const scriptRef = doc.script_ref
  const currentScene = doc.current_scene
  if (typeof scriptRef !== 'string') {
    throw new Error('meta.yaml missing script_ref')
  }
  if (typeof currentScene !== 'string') {
    throw new Error('meta.yaml missing current_scene')
  }
  const lastPlayedAt = typeof doc.last_played_at === 'string' ? doc.last_played_at : undefined
  const currentRoute = typeof doc.current_route === 'string' ? doc.current_route : undefined
  return { scriptRef, currentScene, lastPlayedAt, currentRoute }
}

export function serializeStateFile(parsed: ParsedStateFile): string {
  const doc: MiniDocument = {
    current_scene: parsed.currentScene,
    state: { ...parsed.state } as MiniBlock,
  }
  return serializeMiniYaml(doc)
}

export function serializeMetaFile(meta: MetaFile): string {
  const doc: MiniDocument = {
    script_ref: meta.scriptRef,
    current_scene: meta.currentScene,
  }
  if (meta.lastPlayedAt !== undefined) {
    doc.last_played_at = meta.lastPlayedAt
  }
  if (meta.currentRoute !== undefined) {
    doc.current_route = meta.currentRoute
  }
  return serializeMiniYaml(doc)
}

/**
 * Resolve save paths relative to the skill root. Saves are organized
 * per-script: `runtime/saves/<scriptId>/auto/` for the single auto-save,
 * and `runtime/saves/<scriptId>/manual/<timestamp>/` for manual snapshots.
 */
export function resolveSavePaths(skillRoot: string, scriptId: string, saveType: SaveType = 'auto'): SavePaths {
  const subdir = saveType === 'auto' ? 'auto' : `manual/${saveType.manual}`
  const base = `${skillRoot}/runtime/saves/${scriptId}/${subdir}`
  return {
    stateYamlPath: `${base}/state.yaml`,
    metaYamlPath: `${base}/meta.yaml`,
  }
}

/**
 * Resolve the script file path for a given script id. Strips any `.json` or
 * leading `script-` prefix before rebuilding the canonical form.
 */
export function resolveScriptPath(skillRoot: string, scriptId: string): string {
  let id = scriptId
  if (id.endsWith('.json')) id = id.slice(0, -5)
  if (!id.startsWith('script-')) id = `script-${id}`
  return `${skillRoot}/runtime/scripts/${id}.json`
}

/**
 * Build the save dir from a SavePaths, for rendering in error messages.
 */
export function saveDirOf(paths: SavePaths): string {
  return dirname(paths.stateYamlPath)
}

// Re-export StateRecord for convenience in command modules.
export type { StateRecord }
