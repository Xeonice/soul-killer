import React, { useState, useMemo, useRef } from 'react'
import { Text, Box, useInput } from 'ink'
import { CommandPalette } from './command-palette.js'
import { PathPalette } from './path-palette.js'
import { filterCommands, type CommandDef } from '../command-registry.js'
import { listEntries, buildDisplayPath, type PathItem } from '../path-resolver.js'
import { PRIMARY, DIM } from '../animation/colors.js'

export type ArgCompletionMap = Record<string, { provider: () => CommandDef[]; title: string }>

// ── Cursor helpers ──

/** Find the start of the previous word (for Option+Left / Ctrl+W) */
function prevWordBoundary(text: string, offset: number): number {
  let i = offset - 1
  // Skip whitespace
  while (i > 0 && text[i - 1] === ' ') i--
  // Skip word chars
  while (i > 0 && text[i - 1] !== ' ') i--
  return Math.max(0, i)
}

/** Find the end of the next word (for Option+Right) */
function nextWordBoundary(text: string, offset: number): number {
  let i = offset
  // Skip word chars
  while (i < text.length && text[i] !== ' ') i++
  // Skip whitespace
  while (i < text.length && text[i] === ' ') i++
  return i
}

// ── TextInput ──

interface TextInputProps {
  prompt?: string
  placeholder?: string
  mask?: boolean
  initialValue?: string
  completionItems?: CommandDef[]
  argCompletionMap?: ArgCompletionMap
  pathCompletion?: boolean
  onEscape?: () => void
  onSubmit: (value: string) => void
}

export function TextInput({
  prompt,
  placeholder,
  mask,
  initialValue,
  completionItems,
  argCompletionMap,
  pathCompletion,
  onEscape,
  onSubmit,
}: TextInputProps) {
  const initial = initialValue ?? ''
  const [value, setValue] = useState(initial)
  const [cursor, setCursor] = useState(initial.length)
  const [cmdPaletteOpen, setCmdPaletteOpen] = useState(false)
  const [argPaletteOpen, setArgPaletteOpen] = useState(false)
  const [pathPaletteOpen, setPathPaletteOpen] = useState(false)
  const [selectedIndex, setSelectedIndex] = useState(0)

  // Refs for immediate read in useInput — prevents closure staleness
  // when multiple keystrokes arrive in the same React render frame
  const valueRef = useRef(initial)
  const cursorRef = useRef(initial.length)

  // Helper: update value + cursor together (both state and ref)
  function updateValue(next: string, nextCursor?: number) {
    const nc = nextCursor ?? next.length
    valueRef.current = next
    cursorRef.current = nc
    setValue(next)
    setCursor(nc)

    // Palette open/close logic
    if (next.startsWith('/') && completionItems) {
      const spaceIdx = next.indexOf(' ')
      if (spaceIdx !== -1 && argCompletionMap) {
        const cmdName = next.slice(1, spaceIdx)
        if (argCompletionMap[cmdName]) {
          setCmdPaletteOpen(false)
          setArgPaletteOpen(true)
          setSelectedIndex(0)
        }
      } else {
        setCmdPaletteOpen(true)
        setArgPaletteOpen(false)
        setSelectedIndex(0)
      }
    } else {
      if (!next.startsWith('/')) setCmdPaletteOpen(false)
    }
    if (pathCompletion && next.length > 0) {
      setPathPaletteOpen(true)
      setSelectedIndex(0)
    }
    if (!next) setPathPaletteOpen(false)
  }

  // Command completion filtering
  const filteredCommands = useMemo(() => {
    if (!completionItems || !value.startsWith('/')) return []
    const spaceIdx = value.indexOf(' ')
    if (spaceIdx !== -1) return []
    return filterCommands(value.slice(1))
  }, [completionItems, value])

  // Argument completion filtering
  const argCompletion = useMemo(() => {
    if (!argCompletionMap || !value.startsWith('/')) return null
    const spaceIdx = value.indexOf(' ')
    if (spaceIdx === -1) return null
    const cmdName = value.slice(1, spaceIdx)
    const entry = argCompletionMap[cmdName]
    if (!entry) return null
    const argPrefix = value.slice(spaceIdx + 1).toLowerCase()
    const items = entry.provider().filter((item) =>
      argPrefix === '' || item.name.toLowerCase().startsWith(argPrefix)
    )
    return { items, title: entry.title }
  }, [argCompletionMap, value])

  // Path completion filtering
  const pathItems = useMemo(() => {
    if (!pathCompletion || !pathPaletteOpen || !value) return []
    return listEntries(value)
  }, [pathCompletion, pathPaletteOpen, value])

  const showCmdPalette = cmdPaletteOpen && value.startsWith('/') && filteredCommands.length > 0
  const showArgPalette = argPaletteOpen && argCompletion !== null && argCompletion.items.length > 0
  const showPathPalette = pathPaletteOpen && pathItems.length > 0
  const anyPaletteOpen = showCmdPalette || showArgPalette || showPathPalette

  const currentCount = showCmdPalette
    ? filteredCommands.length
    : showArgPalette
      ? argCompletion!.items.length
      : pathItems.length

  useInput((input, key) => {
    // Read value/cursor from refs to avoid stale closures when
    // multiple keystrokes arrive in the same React render frame
    const val = valueRef.current
    const cur = cursorRef.current

    // Helper: reset value/cursor (for submit paths)
    const resetInput = () => {
      valueRef.current = ''
      cursorRef.current = 0
      setValue('')
      setCursor(0)
    }

    // Esc: close palette first, then call onEscape
    if (key.escape) {
      if (anyPaletteOpen) {
        setCmdPaletteOpen(false)
        setArgPaletteOpen(false)
        setPathPaletteOpen(false)
        return
      }
      onEscape?.()
      return
    }

    // Arrow navigation when any palette is open (up/down only)
    if (anyPaletteOpen) {
      if (key.upArrow) {
        setSelectedIndex((i) => (i - 1 + currentCount) % currentCount)
        return
      }
      if (key.downArrow) {
        setSelectedIndex((i) => (i + 1) % currentCount)
        return
      }
    }

    // Tab handling (palette selection)
    if (key.tab) {
      if (showCmdPalette) {
        const selected = filteredCommands[selectedIndex]
        if (selected) {
          const next = `/${selected.name} `
          updateValue(next)
          setCmdPaletteOpen(false)
          if (argCompletionMap?.[selected.name]) {
            setArgPaletteOpen(true)
            setSelectedIndex(0)
          }
        }
        return
      }
      if (showArgPalette) {
        const selected = argCompletion!.items[selectedIndex]
        if (selected) {
          const spaceIdx = val.indexOf(' ')
          const cmdPart = val.slice(0, spaceIdx + 1)
          updateValue(`${cmdPart}${selected.name}`)
          setArgPaletteOpen(false)
        }
        return
      }
      if (showPathPalette) {
        const selected = pathItems[selectedIndex] as PathItem | undefined
        if (selected) {
          const displayPath = buildDisplayPath(selected, val)
          updateValue(displayPath)
          setSelectedIndex(0)
          if (!selected.isDirectory) {
            setPathPaletteOpen(false)
          }
        }
        return
      }
      return
    }

    // Enter handling
    if (key.return) {
      if (showCmdPalette) {
        const selected = filteredCommands[selectedIndex]
        if (selected) {
          const cmd = `/${selected.name}`
          resetInput()
          setCmdPaletteOpen(false)
          setSelectedIndex(0)
          onSubmit(cmd)
          return
        }
      }
      if (showArgPalette) {
        const selected = argCompletion!.items[selectedIndex]
        if (selected) {
          const spaceIdx = val.indexOf(' ')
          const cmdPart = val.slice(0, spaceIdx + 1)
          const fullCmd = `${cmdPart}${selected.name}`
          resetInput()
          setArgPaletteOpen(false)
          setSelectedIndex(0)
          onSubmit(fullCmd)
          return
        }
      }
      if (showPathPalette) {
        const selected = pathItems[selectedIndex] as PathItem | undefined
        if (selected) {
          const displayPath = buildDisplayPath(selected, val)
          resetInput()
          setPathPaletteOpen(false)
          setSelectedIndex(0)
          onSubmit(displayPath)
          return
        }
      }
      const submitted = val
      resetInput()
      setCmdPaletteOpen(false)
      setArgPaletteOpen(false)
      setPathPaletteOpen(false)
      setSelectedIndex(0)
      onSubmit(submitted)
      return
    }

    // ── Cursor movement ──

    // Home / Ctrl+A — jump to start
    if (key.ctrl && input === 'a') {
      cursorRef.current = 0
      setCursor(0)
      return
    }

    // End / Ctrl+E — jump to end
    if (key.ctrl && input === 'e') {
      cursorRef.current = val.length
      setCursor(val.length)
      return
    }

    // Ctrl+W — delete previous word
    if (key.ctrl && input === 'w') {
      const boundary = prevWordBoundary(val, cur)
      const next = val.slice(0, boundary) + val.slice(cur)
      updateValue(next, boundary)
      return
    }

    // Ctrl+U — delete to start of line
    if (key.ctrl && input === 'u') {
      const next = val.slice(cur)
      updateValue(next, 0)
      return
    }

    // Ctrl+K — delete to end of line
    if (key.ctrl && input === 'k') {
      const next = val.slice(0, cur)
      updateValue(next, cur)
      return
    }

    // Left arrow
    if (key.leftArrow) {
      if (key.meta) {
        // Option+Left — jump to previous word boundary
        const nc = prevWordBoundary(val, cur)
        cursorRef.current = nc
        setCursor(nc)
      } else {
        const nc = Math.max(0, cur - 1)
        cursorRef.current = nc
        setCursor(nc)
      }
      return
    }

    // Right arrow
    if (key.rightArrow) {
      if (key.meta) {
        // Option+Right — jump to next word boundary
        const nc = nextWordBoundary(val, cur)
        cursorRef.current = nc
        setCursor(nc)
      } else {
        const nc = Math.min(val.length, cur + 1)
        cursorRef.current = nc
        setCursor(nc)
      }
      return
    }

    // Option+Backspace — delete previous word
    if ((key.backspace || key.delete) && key.meta) {
      if (cur > 0) {
        const boundary = prevWordBoundary(val, cur)
        const next = val.slice(0, boundary) + val.slice(cur)
        updateValue(next, boundary)
      }
      return
    }

    // Backspace — delete char before cursor
    if (key.backspace || key.delete) {
      if (cur > 0) {
        const next = val.slice(0, cur - 1) + val.slice(cur)
        updateValue(next, cur - 1)
      }
      return
    }

    // Character input — insert at cursor position
    if (input && !key.ctrl && !key.meta) {
      const next = val.slice(0, cur) + input + val.slice(cur)
      updateValue(next, cur + input.length)
    }
  })

  // ── Render ──

  const display = mask ? '•'.repeat(value.length) : value
  const before = display.slice(0, cursor)
  const after = display.slice(cursor + 1)

  return (
    <Box flexDirection="column">
      <Text>
        {prompt && <Text color={PRIMARY}>{prompt} </Text>}
        {value.length > 0 ? (
          <>
            <Text color={PRIMARY}>{before}</Text>
            {cursor < display.length ? (
              <>
                <Text color={PRIMARY} inverse>{display[cursor]}</Text>
                <Text color={PRIMARY}>{after}</Text>
              </>
            ) : (
              <Text color={PRIMARY}>█</Text>
            )}
          </>
        ) : (
          <>
            {placeholder ? (
              <Text color={DIM}>{placeholder}</Text>
            ) : null}
            <Text color={PRIMARY}>█</Text>
          </>
        )}
      </Text>
      {showCmdPalette && (
        <CommandPalette
          items={filteredCommands}
          selectedIndex={selectedIndex}
        />
      )}
      {showArgPalette && (
        <CommandPalette
          items={argCompletion!.items}
          selectedIndex={selectedIndex}
          title={argCompletion!.title}
          showSlash={false}
        />
      )}
      {showPathPalette && (
        <PathPalette
          items={pathItems as PathItem[]}
          selectedIndex={selectedIndex}
        />
      )}
    </Box>
  )
}

interface CheckboxSelectProps<T extends string> {
  items: { value: T; label: string; checked?: boolean }[]
  initialCursor?: number
  onEscape?: () => void
  onSubmit: (selected: T[]) => void
}

export function CheckboxSelect<T extends string>({
  items,
  initialCursor,
  onEscape,
  onSubmit,
}: CheckboxSelectProps<T>) {
  const clamped = Math.max(0, Math.min(items.length - 1, initialCursor ?? 0))
  const [cursor, setCursor] = useState(clamped)
  const [selected, setSelected] = useState<Set<T>>(
    new Set(items.filter((i) => i.checked).map((i) => i.value))
  )

  useInput((input, key) => {
    if (key.escape) {
      onEscape?.()
      return
    }
    if (key.upArrow) {
      setCursor((c) => (c - 1 + items.length) % items.length)
    } else if (key.downArrow) {
      setCursor((c) => (c + 1) % items.length)
    } else if (input === ' ') {
      setSelected((prev) => {
        const next = new Set(prev)
        const val = items[cursor]!.value
        if (next.has(val)) next.delete(val)
        else next.add(val)
        return next
      })
    } else if (key.return) {
      onSubmit([...selected])
    }
  })

  return (
    <>
      {items.map((item, i) => (
        <Text key={item.value}>
          <Text color={i === cursor ? PRIMARY : DIM}>
            {i === cursor ? '❯ ' : '  '}
          </Text>
          <Text color={selected.has(item.value) ? PRIMARY : DIM}>
            {selected.has(item.value) ? '◉' : '◯'} {item.label}
          </Text>
        </Text>
      ))}
    </>
  )
}

interface ConfirmProps {
  message: string
  defaultYes?: boolean
  onConfirm: (yes: boolean) => void
}

export function Confirm({ message, defaultYes = true, onConfirm }: ConfirmProps) {
  useInput((input, key) => {
    if (key.escape) {
      onConfirm(false)
      return
    }
    if (input === 'y' || input === 'Y') {
      onConfirm(true)
      return
    }
    if (input === 'n' || input === 'N') {
      onConfirm(false)
      return
    }
    if (key.return) {
      onConfirm(defaultYes)
    }
  })

  return (
    <Text>
      <Text color={PRIMARY}>{message} </Text>
      <Text color={DIM}>{defaultYes ? '(Y/n) ' : '(y/N) '}</Text>
    </Text>
  )
}
