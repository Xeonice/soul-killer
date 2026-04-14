import React, { useState, useEffect, useCallback } from 'react'
import { Text, Box, useInput } from 'ink'
import { PRIMARY, ACCENT, DIM, WARNING } from '../../animation/colors.js'
import { runUpdate, type UpdateProgress } from '../../updater.js'
import { t } from '../../../infra/i18n/index.js'

interface Props {
  onClose: () => void
  checkOnly?: boolean
}

interface ReleaseInfo {
  local: string
  remote: string
  upToDate: boolean
  notes?: string
}

async function fetchLatestVersion(): Promise<ReleaseInfo> {
  const local = process.env.SOULKILLER_VERSION ?? 'dev'
  const res = await fetch('https://api.github.com/repos/Xeonice/soul-killer/releases/latest', {
    headers: { 'User-Agent': 'soulkiller-upgrade' },
  })
  if (!res.ok) throw new Error(t('upgrade.event.query_failed', { status: String(res.status) }))
  const data = await res.json()
  const remote: string = (data.tag_name ?? 'unknown').replace(/^v/, '')
  const body: string = typeof data.body === 'string' ? data.body : ''
  const notes = body.split('\n').slice(0, 4).join('\n').trim()
  return { local, remote, upToDate: local === remote, notes }
}

type Phase =
  | { kind: 'loading' }
  | { kind: 'error';     message: string }
  | { kind: 'ready';     info: ReleaseInfo }
  | { kind: 'upgrading'; info: ReleaseInfo; events: UpdateProgress[] }
  | { kind: 'success';   info: ReleaseInfo }
  | { kind: 'failed';    info: ReleaseInfo; message: string }

function phaseLabel(event: UpdateProgress): string {
  switch (event.phase) {
    case 'checking':         return t('upgrade.event.checking')
    case 'new-version':      return t('upgrade.event.new_version', { from: event.from, to: event.to })
    case 'hash-change':      return t('upgrade.event.hash_change')
    case 'downloading':      return t('upgrade.event.downloading', { asset: event.assetName })
    case 'checksum-missing': return t('upgrade.event.checksum_missing', { asset: event.assetName })
    case 'extracting':       return t('upgrade.event.extracting')
    case 'replacing':        return t('upgrade.event.replacing')
    case 'viewer-updated':   return t('upgrade.event.viewer_updated')
    case 'complete':         return t('upgrade.event.complete', { version: event.version })
    case 'up-to-date':       return t('upgrade.event.up_to_date', { version: event.version })
    case 'dev-mode':         return t('upgrade.event.dev_mode')
    case 'no-asset':         return t('upgrade.event.no_asset', { platform: event.platform })
    case 'error':            return t('upgrade.event.error', { message: event.message })
  }
}

export function UpgradeCommand({ onClose, checkOnly = false }: Props) {
  const [phase, setPhase] = useState<Phase>({ kind: 'loading' })

  useEffect(() => {
    let cancelled = false
    fetchLatestVersion()
      .then((i) => { if (!cancelled) setPhase({ kind: 'ready', info: i }) })
      .catch((err) => { if (!cancelled) setPhase({ kind: 'error', message: err.message }) })
    return () => { cancelled = true }
  }, [])

  const startUpgrade = useCallback(async (info: ReleaseInfo) => {
    const events: UpdateProgress[] = []
    setPhase({ kind: 'upgrading', info, events: [] })

    let errorMsg: string | null = null
    await runUpdate({
      silent: true,
      onProgress: (event) => {
        events.push(event)
        if (event.phase === 'error') errorMsg = event.message
        setPhase({ kind: 'upgrading', info, events: [...events] })
      },
    })

    if (errorMsg) setPhase({ kind: 'failed', info, message: errorMsg })
    else setPhase({ kind: 'success', info })
  }, [])

  useInput((input, key) => {
    if (phase.kind === 'loading' || phase.kind === 'upgrading') return
    if (phase.kind === 'ready' && !phase.info.upToDate && !checkOnly) {
      if (input === 'y' || input === 'Y') { startUpgrade(phase.info); return }
      if (input === 'n' || input === 'N' || key.escape) { onClose(); return }
      return
    }
    if (key.escape || key.return) onClose()
  })

  if (phase.kind === 'loading') {
    return (
      <Box flexDirection="column" paddingLeft={2}>
        <Text color={ACCENT} bold>{t('upgrade.title')}</Text>
        <Text color={DIM}>{t('upgrade.checking')}</Text>
      </Box>
    )
  }

  if (phase.kind === 'error') {
    return (
      <Box flexDirection="column" paddingLeft={2}>
        <Text color={ACCENT} bold>{t('upgrade.title')}</Text>
        <Text color={WARNING}>✗ {phase.message}</Text>
        <Text color={DIM}>{t('upgrade.enter_esc_close')}</Text>
      </Box>
    )
  }

  if (phase.kind === 'ready' && phase.info.upToDate) {
    return (
      <Box flexDirection="column" paddingLeft={2}>
        <Text color={ACCENT} bold>{t('upgrade.title')}</Text>
        <Text color={PRIMARY}>{t('upgrade.up_to_date', { version: phase.info.local })}</Text>
        <Text color={DIM}>{t('upgrade.enter_esc_close')}</Text>
      </Box>
    )
  }

  if (phase.kind === 'ready') {
    const { info } = phase
    return (
      <Box flexDirection="column" paddingLeft={2}>
        <Text color={ACCENT} bold>{t('upgrade.title')}</Text>
        <Text> </Text>
        <Text color={PRIMARY}>{t('upgrade.local', { version: info.local })}</Text>
        <Text color={PRIMARY}>{t('upgrade.remote_newer', { version: info.remote })}</Text>
        {info.notes && (
          <>
            <Text> </Text>
            <Text color={DIM}>{t('upgrade.release_notes')}</Text>
            {info.notes.split('\n').map((line, i) => (
              <Text key={i} color={DIM}>    {line}</Text>
            ))}
          </>
        )}
        <Text> </Text>
        {checkOnly ? (
          <Text color={DIM}>{t('upgrade.check_only_hint')}</Text>
        ) : (
          <>
            <Text color={DIM}>{t('upgrade.in_place_note', { version: info.local })}</Text>
            <Text color={DIM}>{t('upgrade.after_upgrade_hint', { version: info.remote })}</Text>
            <Text> </Text>
            <Text color={PRIMARY}>{t('upgrade.confirm_prompt')}</Text>
          </>
        )}
        <Text color={DIM}>{t('upgrade.scope_note')}</Text>
      </Box>
    )
  }

  if (phase.kind === 'upgrading') {
    return (
      <Box flexDirection="column" paddingLeft={2}>
        <Text color={ACCENT} bold>{t('upgrade.title_upgrading')}</Text>
        <Text> </Text>
        {phase.events.map((ev, i) => (
          <Text key={i} color={DIM}>  {phaseLabel(ev)}</Text>
        ))}
        <Text> </Text>
        <Text color={DIM}>{t('upgrade.cannot_cancel')}</Text>
      </Box>
    )
  }

  if (phase.kind === 'failed') {
    return (
      <Box flexDirection="column" paddingLeft={2}>
        <Text color={ACCENT} bold>{t('upgrade.title_failed')}</Text>
        <Text color={WARNING}>✗ {phase.message}</Text>
        <Text color={DIM}>{t('upgrade.enter_esc_close')}</Text>
      </Box>
    )
  }

  if (phase.kind === 'success') {
    const { info } = phase
    return (
      <Box flexDirection="column" paddingLeft={2}>
        <Text color={ACCENT} bold>{t('upgrade.title_complete')}</Text>
        <Text> </Text>
        <Text color={PRIMARY}>{t('upgrade.complete_binary', { version: info.remote })}</Text>
        <Text> </Text>
        <Text backgroundColor={WARNING} color="black" bold>
          {t('upgrade.important_tag')}
        </Text>
        <Text color={WARNING}>{t('upgrade.session_still_old', { version: info.local })}</Text>
        <Text color={WARNING}>{t('upgrade.restart_required')}</Text>
        <Text> </Text>
        <Text color={DIM}>{t('upgrade.enter_esc_close')}</Text>
      </Box>
    )
  }

  return null
}
