/**
 * Viewer data loading and file watching.
 *
 * Extracted from tree-server.ts — shared between production and dev server modes.
 */

import { existsSync, readFileSync, watch } from 'node:fs'
import { join, dirname } from 'node:path'
import { readHistory } from './history.js'
import { loadScriptFile } from './script.js'
import { resolveScriptPath, resolveSavePaths, readMetaFile } from './io.js'

export function loadTreeData(skillRoot: string, scriptId: string): Record<string, unknown> {
  const scriptPath = resolveScriptPath(skillRoot, scriptId)
  const script = loadScriptFile(scriptPath)
  const paths = resolveSavePaths(skillRoot, scriptId, 'auto')

  let currentScene = script.firstSceneId
  let history: string[] = []

  if (existsSync(paths.metaYamlPath)) {
    try {
      const meta = readMetaFile(paths.metaYamlPath)
      currentScene = meta.currentScene
    } catch { /* use default */ }
  }

  const historyLogPath = join(dirname(paths.stateYamlPath), 'history.log')
  if (existsSync(historyLogPath)) {
    const entries = readHistory(historyLogPath)
    history = entries.map((e) => `${e.sceneId}:${e.choiceId}`)
  }

  const rawScenes = (script.raw as Record<string, unknown>).scenes as Record<string, Record<string, unknown>> | undefined
  const scenes: Record<string, unknown> = {}
  for (const [id, scene] of script.scenes) {
    const rawScene = rawScenes?.[id]
    scenes[id] = {
      text: scene.text,
      choices: scene.choices,
      route: rawScene?.route ?? scene.route,
      type: rawScene?.type ?? scene.type,
      routing: rawScene?.routing ?? scene.routing,
    }
  }

  const gateScenes: string[] = []
  for (const [id] of script.scenes) {
    const rawScene = rawScenes?.[id]
    if (rawScene?.type === 'affinity_gate') {
      gateScenes.push(id)
    }
  }

  const routeSet = new Set<string>()
  for (const [_id, scene] of script.scenes) {
    const rawScene = rawScenes?.[_id]
    const route = rawScene?.route ?? scene.route
    if (typeof route === 'string') routeSet.add(route)
    const routing = rawScene?.routing ?? scene.routing
    if (Array.isArray(routing)) {
      for (const r of routing as Array<{ route_id?: string }>) {
        if (typeof r.route_id === 'string') routeSet.add(r.route_id)
      }
    }
  }
  const rawRoutes = (script.raw as Record<string, unknown>).routes as string[] | undefined
  if (Array.isArray(rawRoutes)) {
    for (const r of rawRoutes) routeSet.add(r)
  }
  const routes = [...routeSet]

  const endings: Record<string, { text: string; type: string }> = {}
  for (const scene of script.scenes.values()) {
    for (const choice of scene.choices) {
      if (choice.next && !script.scenes.has(choice.next)) {
        endings[choice.next] = { text: choice.next, type: 'ending' }
      }
    }
  }

  return { scenes, history, currentScene, endings, scriptId, routes, gateScenes }
}

export interface FileWatcher {
  close: () => void
}

export function watchSaveDir(
  skillRoot: string,
  scriptId: string,
  onChange: (data: Record<string, unknown>) => void,
): FileWatcher {
  const paths = resolveSavePaths(skillRoot, scriptId, 'auto')
  const saveDir = dirname(paths.stateYamlPath)

  if (!existsSync(saveDir)) return { close: () => {} }

  const watcher = watch(saveDir, (_eventType, filename) => {
    if (filename === 'history.log' || filename === 'meta.yaml') {
      setTimeout(() => {
        const data = loadTreeData(skillRoot, scriptId)
        onChange(data)
      }, 100)
    }
  })

  return { close: () => watcher.close() }
}
