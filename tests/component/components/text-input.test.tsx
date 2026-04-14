import React from 'react'
import { describe, it, expect, vi } from 'vitest'
import { render } from 'ink-testing-library'
import { TextInput, CheckboxSelect } from '../../../src/cli/components/text-input.js'

// Generous delay for ink event processing — needs headroom for parallel test runs
const DELAY = 120

// Key sequences
const LEFT = '\u001B[D'
const RIGHT = '\u001B[C'
const BACKSPACE = '\x7f'
const CTRL_A = '\x01'
const CTRL_E = '\x05'
const CTRL_W = '\x17'
const CTRL_U = '\x15'
const CTRL_K = '\x0b'
const ENTER = '\r'

describe('TextInput cursor editing', () => {
  it('inserts text at cursor position after left arrow', async () => {
    const onSubmit = vi.fn()
    const { stdin } = render(<TextInput onSubmit={onSubmit} />)

    stdin.write('hello')
    await new Promise((r) => setTimeout(r, DELAY))

    stdin.write(LEFT) // cursor before 'o'
    stdin.write(LEFT) // cursor before 'l'
    await new Promise((r) => setTimeout(r, DELAY))

    stdin.write('X')
    await new Promise((r) => setTimeout(r, DELAY))

    stdin.write(ENTER)
    await new Promise((r) => setTimeout(r, DELAY))

    expect(onSubmit).toHaveBeenCalledWith('helXlo')
  })

  it('right arrow moves cursor forward', async () => {
    const onSubmit = vi.fn()
    const { stdin } = render(<TextInput onSubmit={onSubmit} />)

    stdin.write('abc')
    await new Promise((r) => setTimeout(r, DELAY))

    stdin.write(LEFT)
    stdin.write(LEFT)
    stdin.write(LEFT)
    stdin.write(RIGHT) // back to after 'a'
    await new Promise((r) => setTimeout(r, DELAY))

    stdin.write('X')
    await new Promise((r) => setTimeout(r, DELAY))
    stdin.write(ENTER)
    await new Promise((r) => setTimeout(r, DELAY))

    expect(onSubmit).toHaveBeenCalledWith('aXbc')
  })

  it('backspace deletes char before cursor at middle position', async () => {
    const onSubmit = vi.fn()
    const { stdin } = render(<TextInput onSubmit={onSubmit} />)

    stdin.write('hello')
    await new Promise((r) => setTimeout(r, DELAY))

    stdin.write(LEFT)
    stdin.write(LEFT)
    await new Promise((r) => setTimeout(r, DELAY))

    stdin.write(BACKSPACE) // delete 'l' at position 2
    await new Promise((r) => setTimeout(r, DELAY))

    stdin.write(ENTER)
    await new Promise((r) => setTimeout(r, DELAY))

    expect(onSubmit).toHaveBeenCalledWith('helo')
  })

  it('backspace at position 0 does nothing', async () => {
    const onSubmit = vi.fn()
    const { stdin } = render(<TextInput onSubmit={onSubmit} />)

    stdin.write('ab')
    await new Promise((r) => setTimeout(r, DELAY))

    stdin.write(CTRL_A) // move to start
    await new Promise((r) => setTimeout(r, DELAY))

    stdin.write(BACKSPACE) // should do nothing
    await new Promise((r) => setTimeout(r, DELAY))

    stdin.write(ENTER)
    await new Promise((r) => setTimeout(r, DELAY))

    expect(onSubmit).toHaveBeenCalledWith('ab')
  })

  it('Ctrl+A moves cursor to start', async () => {
    const onSubmit = vi.fn()
    const { stdin } = render(<TextInput onSubmit={onSubmit} />)

    stdin.write('hello')
    await new Promise((r) => setTimeout(r, DELAY))

    stdin.write(CTRL_A)
    await new Promise((r) => setTimeout(r, DELAY))

    stdin.write('X')
    await new Promise((r) => setTimeout(r, DELAY))
    stdin.write(ENTER)
    await new Promise((r) => setTimeout(r, DELAY))

    expect(onSubmit).toHaveBeenCalledWith('Xhello')
  })

  it('Ctrl+E moves cursor to end', async () => {
    const onSubmit = vi.fn()
    const { stdin } = render(<TextInput onSubmit={onSubmit} />)

    stdin.write('hello')
    await new Promise((r) => setTimeout(r, DELAY))

    stdin.write(CTRL_A)
    await new Promise((r) => setTimeout(r, DELAY))
    stdin.write(CTRL_E)
    await new Promise((r) => setTimeout(r, DELAY))

    stdin.write('X')
    await new Promise((r) => setTimeout(r, DELAY))
    stdin.write(ENTER)
    await new Promise((r) => setTimeout(r, DELAY))

    expect(onSubmit).toHaveBeenCalledWith('helloX')
  })

  it('cursor does not go below 0', async () => {
    const onSubmit = vi.fn()
    const { stdin } = render(<TextInput onSubmit={onSubmit} />)

    stdin.write('ab')
    await new Promise((r) => setTimeout(r, DELAY))

    // Spam left arrow far past start
    for (let i = 0; i < 10; i++) stdin.write(LEFT)
    await new Promise((r) => setTimeout(r, DELAY))

    stdin.write('X')
    await new Promise((r) => setTimeout(r, DELAY))
    stdin.write(ENTER)
    await new Promise((r) => setTimeout(r, DELAY))

    expect(onSubmit).toHaveBeenCalledWith('Xab')
  })

  it('cursor does not go past end', async () => {
    const onSubmit = vi.fn()
    const { stdin } = render(<TextInput onSubmit={onSubmit} />)

    stdin.write('ab')
    await new Promise((r) => setTimeout(r, DELAY))

    for (let i = 0; i < 10; i++) stdin.write(RIGHT)
    await new Promise((r) => setTimeout(r, DELAY))

    stdin.write('X')
    await new Promise((r) => setTimeout(r, DELAY))
    stdin.write(ENTER)
    await new Promise((r) => setTimeout(r, DELAY))

    expect(onSubmit).toHaveBeenCalledWith('abX')
  })
})

describe('TextInput line editing shortcuts', () => {
  it('Ctrl+W deletes previous word', async () => {
    const onSubmit = vi.fn()
    const { stdin } = render(<TextInput onSubmit={onSubmit} />)

    stdin.write('hello world')
    await new Promise((r) => setTimeout(r, DELAY))

    stdin.write(CTRL_W)
    await new Promise((r) => setTimeout(r, DELAY))

    stdin.write(ENTER)
    await new Promise((r) => setTimeout(r, DELAY))

    expect(onSubmit).toHaveBeenCalledWith('hello ')
  })

  it('Ctrl+W on single word deletes it entirely', async () => {
    const onSubmit = vi.fn()
    const { stdin } = render(<TextInput onSubmit={onSubmit} />)

    stdin.write('hello')
    await new Promise((r) => setTimeout(r, DELAY))

    stdin.write(CTRL_W)
    await new Promise((r) => setTimeout(r, DELAY))

    stdin.write(ENTER)
    await new Promise((r) => setTimeout(r, DELAY))

    expect(onSubmit).toHaveBeenCalledWith('')
  })

  it('Ctrl+W in middle of text preserves rest', async () => {
    const onSubmit = vi.fn()
    const { stdin } = render(<TextInput onSubmit={onSubmit} />)

    stdin.write('one two three')
    await new Promise((r) => setTimeout(r, DELAY))

    // Move cursor left 5 chars (before 'three')
    for (let i = 0; i < 5; i++) stdin.write(LEFT)
    await new Promise((r) => setTimeout(r, DELAY))

    stdin.write(CTRL_W) // deletes 'two '
    await new Promise((r) => setTimeout(r, DELAY))

    stdin.write(ENTER)
    await new Promise((r) => setTimeout(r, DELAY))

    expect(onSubmit).toHaveBeenCalledWith('one three')
  })

  it('multiple Ctrl+W deletes words one by one', async () => {
    const onSubmit = vi.fn()
    const { stdin } = render(<TextInput onSubmit={onSubmit} />)

    stdin.write('one two three')
    await new Promise((r) => setTimeout(r, DELAY))

    stdin.write(CTRL_W) // delete 'three'
    await new Promise((r) => setTimeout(r, DELAY))
    stdin.write(CTRL_W) // delete 'two '
    await new Promise((r) => setTimeout(r, DELAY))

    stdin.write(ENTER)
    await new Promise((r) => setTimeout(r, DELAY))

    expect(onSubmit).toHaveBeenCalledWith('one ')
  })

  it('Ctrl+U deletes to start of line', async () => {
    const onSubmit = vi.fn()
    const { stdin } = render(<TextInput onSubmit={onSubmit} />)

    stdin.write('hello world')
    await new Promise((r) => setTimeout(r, DELAY))

    // Move left 5 (before 'world')
    for (let i = 0; i < 5; i++) stdin.write(LEFT)
    await new Promise((r) => setTimeout(r, DELAY))

    stdin.write(CTRL_U)
    await new Promise((r) => setTimeout(r, DELAY))

    stdin.write(ENTER)
    await new Promise((r) => setTimeout(r, DELAY))

    expect(onSubmit).toHaveBeenCalledWith('world')
  })

  it('Ctrl+K deletes to end of line', async () => {
    const onSubmit = vi.fn()
    const { stdin } = render(<TextInput onSubmit={onSubmit} />)

    stdin.write('hello world')
    await new Promise((r) => setTimeout(r, DELAY))

    // Move left 5 (before 'world')
    for (let i = 0; i < 5; i++) stdin.write(LEFT)
    await new Promise((r) => setTimeout(r, DELAY))

    stdin.write(CTRL_K)
    await new Promise((r) => setTimeout(r, DELAY))

    stdin.write(ENTER)
    await new Promise((r) => setTimeout(r, DELAY))

    expect(onSubmit).toHaveBeenCalledWith('hello ')
  })
})

describe('TextInput rendering', () => {
  it('shows placeholder when empty', () => {
    const { lastFrame } = render(
      <TextInput placeholder="type here" onSubmit={() => {}} />
    )
    const frame = lastFrame()!
    expect(frame).toContain('type here')
    expect(frame).toContain('█')
  })

  it('shows typed text with cursor', async () => {
    const { lastFrame, stdin } = render(
      <TextInput onSubmit={() => {}} />
    )

    stdin.write('hello')
    await new Promise((r) => setTimeout(r, DELAY))

    const frame = lastFrame()!
    expect(frame).toContain('hello')
    expect(frame).toContain('█')
  })

  it('hides placeholder after typing', async () => {
    const { lastFrame, stdin } = render(
      <TextInput placeholder="type here" onSubmit={() => {}} />
    )

    stdin.write('a')
    await new Promise((r) => setTimeout(r, DELAY))

    const frame = lastFrame()!
    expect(frame).not.toContain('type here')
  })

  it('shows prompt inline with input', () => {
    const { lastFrame } = render(
      <TextInput prompt=">" onSubmit={() => {}} />
    )
    const frame = lastFrame()!
    const lines = frame.split('\n').filter((l) => l.trim())
    expect(lines.length).toBe(1)
    expect(lines[0]).toContain('>')
  })

  it('prefills with initialValue and submits unchanged', async () => {
    const onSubmit = vi.fn()
    const { stdin } = render(
      <TextInput initialValue="sk-123" onSubmit={onSubmit} />
    )

    stdin.write(ENTER)
    await new Promise((r) => setTimeout(r, DELAY))

    expect(onSubmit).toHaveBeenCalledWith('sk-123')
  })

  it('initialValue cursor lands at end so backspace trims from tail', async () => {
    const onSubmit = vi.fn()
    const { stdin } = render(
      <TextInput initialValue="abcd" onSubmit={onSubmit} />
    )

    stdin.write(BACKSPACE)
    await new Promise((r) => setTimeout(r, DELAY))
    stdin.write(ENTER)
    await new Promise((r) => setTimeout(r, DELAY))

    expect(onSubmit).toHaveBeenCalledWith('abc')
  })
})

describe('CheckboxSelect initialCursor', () => {
  it('starts cursor at the provided index', () => {
    const { lastFrame } = render(
      <CheckboxSelect
        items={[
          { value: 'a', label: 'alpha' },
          { value: 'b', label: 'beta' },
          { value: 'c', label: 'gamma' },
        ]}
        initialCursor={2}
        onSubmit={() => {}}
      />
    )
    const frame = lastFrame()!
    // The row containing the caret marker '❯' must be the gamma row.
    const caretLine = frame.split('\n').find((l) => l.includes('❯'))!
    expect(caretLine).toContain('gamma')
  })

  it('clamps out-of-range initialCursor to valid bounds', () => {
    const { lastFrame } = render(
      <CheckboxSelect
        items={[
          { value: 'a', label: 'alpha' },
          { value: 'b', label: 'beta' },
        ]}
        initialCursor={99}
        onSubmit={() => {}}
      />
    )
    const frame = lastFrame()!
    const caretLine = frame.split('\n').find((l) => l.includes('❯'))!
    expect(caretLine).toContain('beta')
  })
})
