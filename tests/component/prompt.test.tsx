import React from 'react'
import { describe, it, expect } from 'vitest'
import { render } from 'ink-testing-library'
import { SoulPrompt } from '../../src/cli/components/prompt.js'

describe('SoulPrompt', () => {
  it('mode=void shows soul://void prompt', () => {
    const { lastFrame } = render(<SoulPrompt mode="void" />)
    expect(lastFrame()).toMatchSnapshot()
  })

  it('mode=loaded with soulName shows soul name in prompt', () => {
    const { lastFrame } = render(
      <SoulPrompt mode="loaded" soulName="douglastang" />
    )
    expect(lastFrame()).toMatchSnapshot()
  })

  it('mode=relic with soulName shows [RELIC] indicator', () => {
    const { lastFrame } = render(
      <SoulPrompt mode="relic" soulName="douglastang" status="idle" />
    )
    expect(lastFrame()).toMatchSnapshot()
  })

  it('status=recall shows [RECALL] indicator', () => {
    const { lastFrame } = render(
      <SoulPrompt mode="loaded" soulName="douglastang" status="recall" />
    )
    expect(lastFrame()).toMatchSnapshot()
  })

  it('status=streaming shows [STREAMING] indicator', () => {
    const { lastFrame } = render(
      <SoulPrompt mode="loaded" soulName="douglastang" status="streaming" />
    )
    expect(lastFrame()).toMatchSnapshot()
  })

  it('status=malfunction shows [!MALFUNCTION] indicator', () => {
    const { lastFrame } = render(
      <SoulPrompt mode="loaded" soulName="douglastang" status="malfunction" />
    )
    expect(lastFrame()).toMatchSnapshot()
  })
})
