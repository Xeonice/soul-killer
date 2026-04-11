import React from 'react'
import { describe, it, expect } from 'vitest'
import { render } from 'ink-testing-library'
import { ConversationView, type ConversationMessage } from '../../../src/cli/components/conversation-view.js'

describe('ConversationView', () => {
  const SAMPLE_MESSAGES: ConversationMessage[] = [
    { role: 'user', content: '你好强尼' },
    { role: 'assistant', content: '"Wake the fuck up, samurai! 这可不是什么好时候..." ' },
    { role: 'user', content: '你对企业怎么看？' },
    { role: 'assistant', content: '企业？那群吸血的混蛋。Arasaka、Militech，全他妈一个样。' },
  ]

  it('renders empty conversation', () => {
    const { lastFrame } = render(
      <ConversationView
        messages={[]}
        soulName="强尼银手"
        isThinking={false}
        isStreaming={false}
      />
    )
    expect(lastFrame()).toBe('')
  })

  it('renders user message with ❯ prefix', () => {
    const { lastFrame } = render(
      <ConversationView
        messages={[{ role: 'user', content: '你好强尼' }]}
        soulName="强尼银手"
        isThinking={false}
        isStreaming={false}
      />
    )
    const frame = lastFrame()!
    expect(frame).toContain('❯')
    expect(frame).toContain('你好强尼')
  })

  it('renders assistant message with ◈ soul name header', () => {
    const { lastFrame } = render(
      <ConversationView
        messages={SAMPLE_MESSAGES.slice(0, 2)}
        soulName="强尼银手"
        isThinking={false}
        isStreaming={false}
      />
    )
    const frame = lastFrame()!
    expect(frame).toContain('◈ 强尼银手')
    expect(frame).toContain('Wake the fuck up')
  })

  it('renders multiple turns with both user and assistant messages', () => {
    const { lastFrame } = render(
      <ConversationView
        messages={SAMPLE_MESSAGES}
        soulName="强尼银手"
        isThinking={false}
        isStreaming={false}
      />
    )
    const frame = lastFrame()!
    // Both user messages visible
    expect(frame).toContain('你好强尼')
    expect(frame).toContain('你对企业怎么看')
    // Both assistant responses visible
    expect(frame).toContain('Wake the fuck up')
    expect(frame).toContain('Arasaka')
    // Separator between turns
    expect(frame).toContain('─')
  })

  it('renders thinking indicator when isThinking', () => {
    const { lastFrame } = render(
      <ConversationView
        messages={[{ role: 'user', content: '你好' }]}
        soulName="强尼银手"
        isThinking={true}
        isStreaming={false}
      />
    )
    const frame = lastFrame()!
    expect(frame).toContain('◈ 强尼银手')
    expect(frame).toContain('scanning memory cortex')
  })

  it('renders streaming content when isStreaming', () => {
    const { lastFrame } = render(
      <ConversationView
        messages={[{ role: 'user', content: '你好' }]}
        soulName="强尼银手"
        isThinking={false}
        isStreaming={true}
        streamContent="正在回复中..."
      />
    )
    const frame = lastFrame()!
    expect(frame).toContain('◈ 强尼银手')
    expect(frame).toContain('正在回复中...')
  })

  it('snapshot: multi-turn conversation', () => {
    const { lastFrame } = render(
      <ConversationView
        messages={SAMPLE_MESSAGES}
        soulName="强尼银手"
        isThinking={false}
        isStreaming={false}
      />
    )
    expect(lastFrame()).toMatchSnapshot()
  })
})
