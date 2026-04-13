import React, { useState, useCallback, useEffect, useRef } from 'react'
import { Box, Text } from 'ink'
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import {
  ExportProtocolPanel,
  createInitialPanelState,
  reducePanelEvent,
  type ExportPanelState,
} from '../../animation/export-protocol-panel.js'
import {
  runExportAgent,
  type ExportProgressEvent,
  type AskUserOption,
  type PreSelectedExportData,
  type SoulFullData,
  type WorldFullData,
} from '../../../export/agent/index.js'
import { loadConfig } from '../../../config/loader.js'
import { TextInput } from '../../components/text-input.js'
import { readManifest, readSoulFiles } from '../../../soul/package.js'
import { listWorlds, loadWorld } from '../../../world/manifest.js'
import { loadAllEntries } from '../../../world/entry.js'
import { t } from '../../../infra/i18n/index.js'
import { getLocale } from '../../../infra/i18n/index.js'
import type { SupportedLanguage } from '../../../config/schema.js'
import { SUPPORTED_LANGUAGES } from '../../../config/schema.js'
import { PRIMARY, DIM, ACCENT } from '../../animation/colors.js'

interface ExportCommandProps {
  onComplete: () => void
  onCancel: () => void
}

type UIStep =
  | 'loading-lists'
  | 'empty-souls'
  | 'empty-worlds'
  | 'selecting-souls'
  | 'selecting-world'
  | 'naming-story'
  | 'story-direction'
  | 'selecting-language'
  | 'selecting-output'
  | 'loading-data'
  | 'running'

interface SoulListItem {
  name: string
  display_name: string
}

interface WorldListItem {
  name: string
  display_name: string
}

interface OutputOption {
  key: 'default' | 'project' | 'global'
  labelKey: string
  path: string
}

function buildOutputOptions(): OutputOption[] {
  return [
    {
      key: 'default',
      labelKey: 'export.output.default',
      path: path.join(os.homedir(), '.soulkiller', 'exports'),
    },
    {
      key: 'project',
      labelKey: 'export.output.project',
      path: path.resolve('.claude/skills'),
    },
    {
      key: 'global',
      labelKey: 'export.output.global',
      path: path.join(os.homedir(), '.claude', 'skills'),
    },
  ]
}

export function ExportCommand({ onComplete, onCancel }: ExportCommandProps) {
  const [uiStep, setUiStep] = useState<UIStep>('loading-lists')
  const [panelState, setPanelState] = useState<ExportPanelState>(createInitialPanelState)

  // Text input overlay (used for naming-story, story-direction, and agent ask_user free text)
  const [textInputActive, setTextInputActive] = useState(false)
  const [textInputPrompt, setTextInputPrompt] = useState('')
  const [textInputOptional, setTextInputOptional] = useState(false)
  const [textInputError, setTextInputError] = useState<string | undefined>()

  // Available lists
  const [availableSouls, setAvailableSouls] = useState<SoulListItem[]>([])
  const [availableWorlds, setAvailableWorlds] = useState<WorldListItem[]>([])

  // User selections
  const [selectedSouls, setSelectedSouls] = useState<string[]>([])
  const [selectedWorld, setSelectedWorld] = useState<string>('')
  const [storyName, setStoryName] = useState<string>('')
  const [storyDirection, setStoryDirection] = useState<string>('')
  const [exportLanguage, setExportLanguage] = useState<SupportedLanguage>(getLocale())
  const [outputBaseDir, setOutputBaseDir] = useState<string>('')

  // Output options (built once on mount)
  const outputOptionsRef = useRef<OutputOption[]>(buildOutputOptions())

  // Promise resolvers for agent ask_user bridging
  const askResolverRef = useRef<((answer: string) => void) | null>(null)
  // Promise resolver for plan confirmation (Enter → confirm, Esc → cancel)
  const planConfirmResolverRef = useRef<((confirmed: boolean) => void) | null>(null)
  const cancelledRef = useRef(false)

  const handleProgress = useCallback((event: ExportProgressEvent) => {
    if (cancelledRef.current) return
    setPanelState((prev) => reducePanelEvent(prev, event))
  }, [])

  const handleAskUser = useCallback(
    (question: string, options?: AskUserOption[], allowFreeInput?: boolean, multiSelect?: boolean, maxSelect?: number): Promise<string> => {
      return new Promise((resolve) => {
        askResolverRef.current = resolve

        if (options && options.length > 0) {
          // Multi-select or single-select mode with options
          const preSelected = options
            .map((o, i) => (o.preSelected ? i : -1))
            .filter((i) => i >= 0)
          setPanelState((prev) => ({
            ...prev,
            activeZone: {
              type: 'select',
              question,
              options: options.map((o) => ({ label: o.label, description: o.description })),
              cursor: 0,
              multi: multiSelect ?? false,
              selected: preSelected,
              maxSelect,
            },
          }))
        } else if (allowFreeInput) {
          // Free text input mode (agent-triggered)
          setTextInputActive(true)
          setTextInputPrompt(question)
          setTextInputOptional(false)
        }
      })
    },
    [],
  )

  // --- Helpers to drive panel UI directly (without going through agent events) ---

  function showSoulSelector(souls: SoulListItem[]) {
    setPanelState({
      phase: 'selecting',
      planningTrail: [],
      trail: [],
      activeZone: {
        type: 'select',
        question: t('export.step.select_souls'),
        options: souls.map((s) => ({ label: s.display_name || s.name, description: s.name !== s.display_name ? s.name : undefined })),
        cursor: 0,
        multi: true,
        selected: [],
      },
    })
  }

  function showWorldSelector(worlds: WorldListItem[], soulsPicked: string[]) {
    setPanelState({
      phase: 'selecting',
      planningTrail: [],
      trail: [{ description: t('export.step.select_souls'), summary: `${soulsPicked.length} ${t('export.souls_unit')}` }],
      activeZone: {
        type: 'select',
        question: t('export.step.select_world'),
        options: worlds.map((w) => ({ label: w.display_name || w.name, description: w.name !== w.display_name ? w.name : undefined })),
        cursor: 0,
        multi: false,
      },
    })
  }

  function showNameStoryInput(soulsCount: number, worldLabel: string) {
    setPanelState({
      phase: 'selecting',
      planningTrail: [],
      trail: [
        { description: t('export.step.select_souls'), summary: `${soulsCount} ${t('export.souls_unit')}` },
        { description: t('export.step.select_world'), summary: worldLabel },
      ],
      activeZone: { type: 'idle' },
    })
    setTextInputActive(true)
    setTextInputPrompt(t('export.step.naming_story'))
    setTextInputOptional(false)
    setTextInputError(undefined)
  }

  function showStoryDirectionInput(soulsCount: number, worldLabel: string, story: string) {
    setPanelState({
      phase: 'selecting',
      planningTrail: [],
      trail: [
        { description: t('export.step.select_souls'), summary: `${soulsCount} ${t('export.souls_unit')}` },
        { description: t('export.step.select_world'), summary: worldLabel },
        { description: t('export.step.naming_story'), summary: story },
      ],
      activeZone: { type: 'idle' },
    })
    setTextInputActive(true)
    setTextInputPrompt(t('export.step.story_direction'))
    setTextInputOptional(true)
    setTextInputError(undefined)
  }

  function showOutputSelector(soulsCount: number, worldLabel: string, story: string, direction: string) {
    const options = outputOptionsRef.current
    const trailItems: { description: string; summary?: string }[] = [
      { description: t('export.step.select_souls'), summary: `${soulsCount} ${t('export.souls_unit')}` },
      { description: t('export.step.select_world'), summary: worldLabel },
      { description: t('export.step.naming_story'), summary: story },
    ]
    if (direction.trim().length > 0) {
      trailItems.push({ description: t('export.step.story_direction'), summary: '✓' })
    }
    setPanelState({
      phase: 'selecting',
      planningTrail: [],
      trail: trailItems,
      activeZone: {
        type: 'select',
        question: t('export.step.selecting_output'),
        options: options.map((o) => ({ label: t(o.labelKey), description: o.path })),
        cursor: 0,
        multi: false,
      },
    })
  }

  function showLanguageSelector() {
    const langOptions: { label: string; code: SupportedLanguage }[] = [
      { label: '中文 (zh)', code: 'zh' },
      { label: 'English (en)', code: 'en' },
      { label: '日本語 (ja)', code: 'ja' },
    ]
    const currentIdx = langOptions.findIndex((o) => o.code === exportLanguage)
    setPanelState({
      phase: 'selecting',
      planningTrail: [],
      trail: [
        { description: t('export.step.select_souls'), summary: `${selectedSouls.length} ${t('export.souls_unit')}` },
        { description: t('export.step.select_world'), summary: selectedWorld },
        { description: t('export.step.naming_story'), summary: storyName },
      ],
      activeZone: {
        type: 'select',
        question: t('export.step.select_language'),
        options: langOptions.map((o) => ({ label: o.label })),
        cursor: currentIdx >= 0 ? currentIdx : 0,
        multi: false,
      },
    })
  }

  function showIdleWithTrail(trail: { description: string; summary?: string }[], phase: ExportPanelState['phase']) {
    setPanelState({ phase, planningTrail: [], trail, activeZone: { type: 'idle' } })
  }

  function showError(errorMsg: string) {
    setPanelState((prev) => ({
      ...prev,
      phase: 'error',
      activeZone: { type: 'error', error: errorMsg },
    }))
  }

  const handlePlanConfirm = useCallback(() => {
    if (planConfirmResolverRef.current) {
      planConfirmResolverRef.current(true)
      planConfirmResolverRef.current = null
    }
  }, [])

  const handleCancel = useCallback(() => {
    // Step-specific Esc navigation
    if (uiStep === 'selecting-world') {
      setUiStep('selecting-souls')
      showSoulSelector(availableSouls)
      return
    }
    if (uiStep === 'naming-story') {
      setTextInputActive(false)
      setTextInputError(undefined)
      setUiStep('selecting-world')
      showWorldSelector(availableWorlds, selectedSouls)
      return
    }
    if (uiStep === 'story-direction') {
      setTextInputActive(false)
      setTextInputError(undefined)
      setUiStep('naming-story')
      const worldItem = availableWorlds.find((w) => w.name === selectedWorld)
      showNameStoryInput(selectedSouls.length, worldItem?.display_name || selectedWorld)
      return
    }
    if (uiStep === 'selecting-language') {
      setUiStep('story-direction')
      const worldItem = availableWorlds.find((w) => w.name === selectedWorld)
      showStoryDirectionInput(selectedSouls.length, worldItem?.display_name || selectedWorld, storyName)
      return
    }
    if (uiStep === 'selecting-output') {
      setUiStep('selecting-language')
      setTimeout(() => showLanguageSelector(), 0)
      return
    }

    // All other steps: cancel the entire flow
    cancelledRef.current = true
    if (planConfirmResolverRef.current) {
      planConfirmResolverRef.current(false)
      planConfirmResolverRef.current = null
    }
    if (askResolverRef.current) {
      askResolverRef.current('')
      askResolverRef.current = null
    }
    onCancel()
  }, [uiStep, availableSouls, availableWorlds, selectedSouls, selectedWorld, storyName, onCancel])

  // --- Step 1: Load available souls and worlds on mount ---

  useEffect(() => {
    const soulsDir = path.join(os.homedir(), '.soulkiller', 'souls')
    const souls: SoulListItem[] = []
    if (fs.existsSync(soulsDir)) {
      for (const entry of fs.readdirSync(soulsDir, { withFileTypes: true })) {
        if (!entry.isDirectory()) continue
        const soulDir = path.join(soulsDir, entry.name)
        const manifest = readManifest(soulDir)
        if (!manifest) continue
        const identityPath = path.join(soulDir, 'soul', 'identity.md')
        if (!fs.existsSync(identityPath) || fs.statSync(identityPath).size < 100) continue
        souls.push({ name: manifest.name, display_name: manifest.display_name })
      }
    }

    const worldManifests = listWorlds()
    const worlds: WorldListItem[] = worldManifests.map((w) => ({
      name: w.name,
      display_name: w.display_name,
    }))

    setAvailableSouls(souls)
    setAvailableWorlds(worlds)

    if (souls.length === 0) {
      setUiStep('empty-souls')
      showError(t('export.err.no_souls'))
      return
    }
    if (worlds.length === 0) {
      setUiStep('empty-worlds')
      showError(t('export.err.no_worlds'))
      return
    }

    setUiStep('selecting-souls')
    showSoulSelector(souls)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // --- Text input submit: handles naming-story, story-direction, and agent free-text ---

  const handleTextSubmit = useCallback((value: string) => {
    // Agent ask_user free-text path
    if (askResolverRef.current) {
      askResolverRef.current(value)
      askResolverRef.current = null
      setTextInputActive(false)
      setTextInputPrompt('')
      setTextInputError(undefined)
      return
    }

    // UI-driven naming-story path
    if (uiStep === 'naming-story') {
      const trimmed = value.trim()
      if (trimmed.length === 0) {
        setTextInputError(t('export.err.story_name_required'))
        return // stay on naming-story
      }
      setStoryName(trimmed)
      setTextInputActive(false)
      setTextInputError(undefined)
      setUiStep('story-direction')
      const worldItem = availableWorlds.find((w) => w.name === selectedWorld)
      showStoryDirectionInput(selectedSouls.length, worldItem?.display_name || selectedWorld, trimmed)
      return
    }

    // UI-driven story-direction path (may be empty = skip)
    if (uiStep === 'story-direction') {
      setStoryDirection(value) // may be empty
      setTextInputActive(false)
      setTextInputError(undefined)
      // Show language selection
      setUiStep('selecting-language')
      setTimeout(() => showLanguageSelector(), 0)
      return
    }
  }, [uiStep, availableWorlds, selectedWorld, selectedSouls.length, storyName])

  // --- Handle select confirm (for UI-driven selection + agent-driven ask_user) ---

  const handleSelectConfirm = useCallback((signal: number) => {
    setPanelState((prev) => {
      if (prev.activeZone.type !== 'select') return prev

      if (signal === -1) {
        const newCursor = (prev.activeZone.cursor - 1 + prev.activeZone.options.length) % prev.activeZone.options.length
        return { ...prev, activeZone: { ...prev.activeZone, cursor: newCursor } }
      }
      if (signal === -2) {
        const newCursor = (prev.activeZone.cursor + 1) % prev.activeZone.options.length
        return { ...prev, activeZone: { ...prev.activeZone, cursor: newCursor } }
      }
      if (signal === -3) {
        if (!prev.activeZone.multi) return prev
        const currentSelected = prev.activeZone.selected ?? []
        const cursor = prev.activeZone.cursor
        const isDeselect = currentSelected.includes(cursor)
        if (!isDeselect && prev.activeZone.maxSelect && currentSelected.length >= prev.activeZone.maxSelect) {
          return prev // Already at max — ignore toggle
        }
        const newSelected = isDeselect
          ? currentSelected.filter((i) => i !== cursor)
          : [...currentSelected, cursor]
        return { ...prev, activeZone: { ...prev.activeZone, selected: newSelected } }
      }

      // Confirm
      const activeZone = prev.activeZone
      const isUIDriven = askResolverRef.current === null

      if (isUIDriven) {
        // selecting-souls (multi)
        if (activeZone.multi) {
          const selectedIndices = activeZone.selected ?? []
          if (selectedIndices.length === 0) {
            return prev // stay — validation error shown by caller
          }
          const labels = selectedIndices
            .map((i) => activeZone.options[i]?.label)
            .filter((l): l is string => !!l)
          const picked = labels
            .map((label) => availableSouls.find((s) => (s.display_name || s.name) === label)?.name)
            .filter((n): n is string => !!n)
          setSelectedSouls(picked)
          setUiStep('selecting-world')
          setTimeout(() => showWorldSelector(availableWorlds, picked), 0)
          return prev
        }

        // Single-select branch
        const selectedIdx = signal >= 0 ? signal : activeZone.cursor
        const chosen = activeZone.options[selectedIdx]
        if (!chosen) return prev

        if (uiStep === 'selecting-world') {
          const worldName = availableWorlds.find((w) => (w.display_name || w.name) === chosen.label)?.name
          if (!worldName) return prev
          setSelectedWorld(worldName)
          setUiStep('naming-story')
          setTimeout(() => showNameStoryInput(selectedSouls.length, chosen.label), 0)
          return prev
        }

        if (uiStep === 'selecting-language') {
          const langMap: SupportedLanguage[] = ['zh', 'en', 'ja'] // must match showLanguageSelector order
          const selectedLang = langMap[activeZone.cursor] ?? 'zh'
          setExportLanguage(selectedLang)
          setUiStep('selecting-output')
          const worldItem = availableWorlds.find((w) => w.name === selectedWorld)
          setTimeout(() => showOutputSelector(selectedSouls.length, worldItem?.display_name || selectedWorld, storyName, storyDirection), 0)
          return prev
        }

        if (uiStep === 'selecting-output') {
          // Map label back to output option
          const options = outputOptionsRef.current
          const optIdx = activeZone.cursor
          const opt = options[optIdx]
          if (!opt) return prev
          setOutputBaseDir(opt.path)
          setUiStep('loading-data')
          setTimeout(() => beginExport(selectedSouls, selectedWorld, storyName, storyDirection, opt.path), 0)
          return prev
        }
      } else {
        // Agent-driven ask_user
        if (activeZone.multi) {
          const selectedIndices = activeZone.selected ?? []
          const labels = selectedIndices
            .map((i) => activeZone.options[i]?.label)
            .filter((l): l is string => !!l)
          if (askResolverRef.current) {
            (askResolverRef.current as (s: string) => void)(labels.join(','))
            askResolverRef.current = null
          }
        } else {
          const selected = activeZone.options[signal]
          if (selected && askResolverRef.current) {
            (askResolverRef.current as (s: string) => void)(selected.label)
            askResolverRef.current = null
          }
        }
      }
      return prev
    })
  }, [uiStep, availableSouls, availableWorlds, selectedSouls, selectedWorld, storyName, storyDirection]) // eslint-disable-line react-hooks/exhaustive-deps

  // --- Begin export: load data + run agent ---

  async function beginExport(souls: string[], worldName: string, name: string, direction: string, outBaseDir: string) {
    const trail: { description: string; summary?: string }[] = [
      { description: t('export.step.select_souls'), summary: `${souls.length} ${t('export.souls_unit')}` },
      { description: t('export.step.select_world'), summary: worldName },
      { description: t('export.step.naming_story'), summary: name },
    ]
    if (direction.trim().length > 0) {
      trail.push({ description: t('export.step.story_direction'), summary: '✓' })
    }
    trail.push({ description: t('export.step.selecting_output'), summary: outBaseDir })
    showIdleWithTrail(trail, 'analyzing')

    try {
      const soulsData: SoulFullData[] = []
      for (const soulName of souls) {
        const soulDir = path.join(os.homedir(), '.soulkiller', 'souls', soulName)
        const manifest = readManifest(soulDir)
        if (!manifest) throw new Error(t('export.err.cannot_read_soul', { name: soulName }))
        const files = readSoulFiles(soulDir)

        const behaviorsDir = path.join(soulDir, 'soul', 'behaviors')
        const behaviors: { name: string; content: string }[] = []
        if (fs.existsSync(behaviorsDir)) {
          for (const f of fs.readdirSync(behaviorsDir)) {
            if (!f.endsWith('.md')) continue
            behaviors.push({
              name: f.replace('.md', ''),
              content: fs.readFileSync(path.join(behaviorsDir, f), 'utf-8'),
            })
          }
        }

        soulsData.push({
          name: soulName,
          manifest,
          identity: files.identity,
          style: files.style,
          capabilities: files.capabilities,
          milestones: files.milestones,
          behaviors,
        })
      }

      const worldManifest = loadWorld(worldName)
      if (!worldManifest) throw new Error(t('export.err.cannot_read_world', { name: worldName }))
      const entries = loadAllEntries(worldName)
      const worldData: WorldFullData = {
        name: worldName,
        manifest: worldManifest,
        entries: entries.map((e) => ({
          name: e.meta.name,
          meta: e.meta as unknown as Record<string, unknown>,
          content: e.content,
        })),
      }

      const preSelected: PreSelectedExportData = {
        souls,
        worldName,
        soulsData,
        worldData,
        storyName: name,
        storyDirection: direction.trim().length > 0 ? direction.trim() : undefined,
        outputBaseDir: outBaseDir,
        exportLanguage,
      }

      setUiStep('running')
      setPanelState({
        phase: 'analyzing',
        planningTrail: [],
        trail,
        activeZone: { type: 'idle' },
      })

      const config = loadConfig()
      if (!config) {
        showError(t('export.err.config_not_initialized'))
        return
      }

      const waitForPlanConfirm = () => new Promise<boolean>((resolve) => {
        planConfirmResolverRef.current = resolve
      })
      await runExportAgent(config, preSelected, handleProgress, handleAskUser, waitForPlanConfirm)
    } catch (err) {
      showError(err instanceof Error ? err.message : String(err))
    }
  }

  return (
    <Box flexDirection="column">
      <ExportProtocolPanel
        phase={panelState.phase}
        planningTrail={panelState.planningTrail}
        trail={panelState.trail}
        activeZone={panelState.activeZone}
        onSelectConfirm={handleSelectConfirm}
        onTextSubmit={handleTextSubmit}
        onPlanConfirm={handlePlanConfirm}
        onCancel={handleCancel}
      />
      {textInputActive && (
        <Box flexDirection="column" marginLeft={2} marginTop={1}>
          <Text color={PRIMARY}>▓ {textInputPrompt}{textInputOptional && <Text color={DIM}> ({t('export.hint.optional')})</Text>}</Text>
          <TextInput
            prompt="  ❯ "
            onSubmit={handleTextSubmit}
            onEscape={handleCancel}
          />
          {textInputError && (
            <Text color={ACCENT}>  ⚠ {textInputError}</Text>
          )}
        </Box>
      )}
      {panelState.phase === 'complete' && (
        <Box marginTop={1}>
          <TextInput
            prompt=""
            placeholder={t('export.hint.press_enter_to_return')}
            onSubmit={onComplete}
            onEscape={onComplete}
          />
        </Box>
      )}
      {panelState.phase === 'error' && (
        <Box marginTop={1}>
          <TextInput
            prompt=""
            placeholder={t('export.hint.press_enter_to_return')}
            onSubmit={onCancel}
            onEscape={onCancel}
          />
        </Box>
      )}
    </Box>
  )
}
