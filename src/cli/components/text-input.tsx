import React, { useState, useMemo } from 'react'
import { Text, Box, useInput } from 'ink'
import { CommandPalette } from './command-palette.js'
import { PathPalette } from './path-palette.js'
import { filterCommands, type CommandDef } from '../command-registry.js'
import { listEntries, buildDisplayPath, type PathItem } from '../path-resolver.js'
import { PRIMARY, DIM } from '../animation/colors.js'

export type ArgCompletionMap = Record<string, { provider: () => CommandDef[]; title: string }>

interface TextInputProps {
  prompt?: string
  placeholder?: string
  mask?: boolean
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
  completionItems,
  argCompletionMap,
  pathCompletion,
  onEscape,
  onSubmit,
}: TextInputProps) {
  const [value, setValue] = useState('')
  const [cmdPaletteOpen, setCmdPaletteOpen] = useState(false)
  const [argPaletteOpen, setArgPaletteOpen] = useState(false)
  const [pathPaletteOpen, setPathPaletteOpen] = useState(false)
  const [selectedIndex, setSelectedIndex] = useState(0)

  // Command completion filtering
  const filteredCommands = useMemo(() => {
    if (!completionItems || !value.startsWith('/')) return []
    // Don't show command completion if we're in arg completion mode
    const spaceIdx = value.indexOf(' ')
    if (spaceIdx !== -1) return [] // Has space = arg mode, not command mode
    return filterCommands(value.slice(1))
  }, [completionItems, value])

  // Argument completion filtering
  const argCompletion = useMemo(() => {
    if (!argCompletionMap || !value.startsWith('/')) return null
    const spaceIdx = value.indexOf(' ')
    if (spaceIdx === -1) return null // No space yet, still typing command
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

    // Arrow navigation when any palette is open
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

    // Tab handling
    if (key.tab) {
      if (showCmdPalette) {
        const selected = filteredCommands[selectedIndex]
        if (selected) {
          setValue(`/${selected.name} `)
          setCmdPaletteOpen(false)
          // Open arg completion if available
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
          const spaceIdx = value.indexOf(' ')
          const cmdPart = value.slice(0, spaceIdx + 1)
          setValue(`${cmdPart}${selected.name}`)
          setArgPaletteOpen(false)
        }
        return
      }
      if (showPathPalette) {
        const selected = pathItems[selectedIndex] as PathItem | undefined
        if (selected) {
          const displayPath = buildDisplayPath(selected, value)
          setValue(displayPath)
          setSelectedIndex(0)
          if (selected.isDirectory) {
            // Stay open, will re-query next level
          } else {
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
          setValue('')
          setCmdPaletteOpen(false)
          setSelectedIndex(0)
          onSubmit(cmd)
        }
        return
      }
      if (showArgPalette) {
        const selected = argCompletion!.items[selectedIndex]
        if (selected) {
          const spaceIdx = value.indexOf(' ')
          const cmdPart = value.slice(0, spaceIdx + 1)
          const fullCmd = `${cmdPart}${selected.name}`
          setValue('')
          setArgPaletteOpen(false)
          setSelectedIndex(0)
          onSubmit(fullCmd)
        }
        return
      }
      if (showPathPalette) {
        const selected = pathItems[selectedIndex] as PathItem | undefined
        if (selected) {
          const displayPath = buildDisplayPath(selected, value)
          setValue('')
          setPathPaletteOpen(false)
          setSelectedIndex(0)
          onSubmit(displayPath)
          return
        }
      }
      const submitted = value
      setValue('')
      setCmdPaletteOpen(false)
      setArgPaletteOpen(false)
      setPathPaletteOpen(false)
      setSelectedIndex(0)
      onSubmit(submitted)
      return
    }

    // Backspace
    if (key.backspace || key.delete) {
      setValue((v) => {
        const next = v.slice(0, -1)
        if (!next.startsWith('/')) setCmdPaletteOpen(false)
        if (!next) setPathPaletteOpen(false)
        setSelectedIndex(0)
        return next
      })
      return
    }

    // Character input
    if (input && !key.ctrl && !key.meta) {
      setValue((v) => {
        const next = v + input
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
        }
        if (pathCompletion && next.length > 0) {
          setPathPaletteOpen(true)
          setSelectedIndex(0)
        }
        return next
      })
    }
  })

  const display = mask ? '•'.repeat(value.length) : value

  return (
    <Box flexDirection="column">
      <Text>
        {prompt && <Text color={PRIMARY}>{prompt} </Text>}
        <Text color={PRIMARY}>{display}</Text>
        {!value && placeholder && <Text color={DIM}>{placeholder}</Text>}
        <Text color={PRIMARY}>█</Text>
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
  onEscape?: () => void
  onSubmit: (selected: T[]) => void
}

export function CheckboxSelect<T extends string>({
  items,
  onEscape,
  onSubmit,
}: CheckboxSelectProps<T>) {
  const [cursor, setCursor] = useState(0)
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
  onConfirm: (yes: boolean) => void
}

export function Confirm({ message, onConfirm }: ConfirmProps) {
  useInput((input) => {
    if (input === 'y' || input === 'Y' || input === '\r') {
      onConfirm(true)
    } else if (input === 'n' || input === 'N') {
      onConfirm(false)
    }
  })

  return (
    <Text>
      <Text color={PRIMARY}>{message} </Text>
      <Text color={DIM}>(Y/n) </Text>
    </Text>
  )
}
