import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import crypto from 'node:crypto'
import { TwitterAdapter } from '../../src/ingest/twitter-adapter.js'

// ── helpers ───────────────────────────────────────────────────────────────────

async function collect<T>(iterable: AsyncIterable<T>): Promise<T[]> {
  const results: T[] = []
  for await (const item of iterable) {
    results.push(item)
  }
  return results
}

interface TweetData {
  id_str: string
  full_text: string
  created_at: string
  in_reply_to_status_id_str?: string
  entities?: {
    urls?: { expanded_url: string }[]
  }
}

function makeTweet(overrides: Partial<TweetData> = {}): { tweet: TweetData } {
  return {
    tweet: {
      id_str: crypto.randomUUID().replace(/-/g, '').slice(0, 18),
      full_text: 'A regular tweet with some meaningful content.',
      created_at: 'Mon Jan 01 12:00:00 +0000 2024',
      ...overrides,
    },
  }
}

/** Writes a tweets.js file using the real Twitter archive format. */
function writeTweetsJs(dir: string, tweets: { tweet: TweetData }[]): void {
  const content = `window.YTD.tweet.part0 = ${JSON.stringify(tweets, null, 2)}`
  fs.writeFileSync(path.join(dir, 'tweets.js'), content, 'utf-8')
}

/**
 * TwitterAdapter looks first in <path>/data/tweets.js, then <path>/tweets.js.
 * This helper sets up the alternative (flat) structure for simplicity.
 */
function makeArchive(tweets: { tweet: TweetData }[]): string {
  const archiveDir = path.join(os.tmpdir(), `tw-archive-${crypto.randomUUID()}`)
  fs.mkdirSync(archiveDir, { recursive: true })
  writeTweetsJs(archiveDir, tweets)
  return archiveDir
}

// ── dates for threading tests ─────────────────────────────────────────────────

const T0 = 'Mon Jan 01 12:00:00 +0000 2024'  // baseline
const T10 = 'Mon Jan 01 12:10:00 +0000 2024' // +10 min
const T20 = 'Mon Jan 01 12:20:00 +0000 2024' // +20 min
const T60 = 'Mon Jan 01 13:00:00 +0000 2024' // +60 min (> 30 min gap)
const T90 = 'Mon Jan 01 13:30:00 +0000 2024' // +90 min

// ── suite ─────────────────────────────────────────────────────────────────────

describe('TwitterAdapter', () => {
  let adapter: TwitterAdapter
  let archiveDirs: string[]

  beforeEach(() => {
    adapter = new TwitterAdapter()
    archiveDirs = []
  })

  afterEach(() => {
    for (const dir of archiveDirs) {
      fs.rmSync(dir, { recursive: true, force: true })
    }
  })

  function archive(tweets: { tweet: TweetData }[]): string {
    const dir = makeArchive(tweets)
    archiveDirs.push(dir)
    return dir
  }

  // ── parsing ────────────────────────────────────────────────────────────────

  describe('tweets.js parsing', () => {
    it('parses tweets.js with the "window.YTD.tweet.part0 = " prefix', async () => {
      const dir = archive([makeTweet({ full_text: 'Hello world' })])
      const chunks = await collect(adapter.adapt(dir))
      expect(chunks).toHaveLength(1)
      expect(chunks[0]!.content).toContain('Hello world')
    })

    it('parses multiple tweets from the same file', async () => {
      const dir = archive([
        makeTweet({ id_str: '1', full_text: 'Tweet A', created_at: T0 }),
        makeTweet({ id_str: '2', full_text: 'Tweet B', created_at: T60 }),
      ])
      const chunks = await collect(adapter.adapt(dir))
      // Two tweets >30 min apart → two separate chunks
      expect(chunks).toHaveLength(2)
    })

    it('throws when tweets.js is not found in the archive path', async () => {
      const emptyDir = path.join(os.tmpdir(), `tw-empty-${crypto.randomUUID()}`)
      archiveDirs.push(emptyDir)
      fs.mkdirSync(emptyDir, { recursive: true })

      await expect(collect(adapter.adapt(emptyDir))).rejects.toThrow('tweets.js not found')
    })

    it('sets source to "twitter" on all chunks', async () => {
      const dir = archive([makeTweet()])
      const chunks = await collect(adapter.adapt(dir))
      expect(chunks[0]!.source).toBe('twitter')
    })
  })

  // ── RT filtering ───────────────────────────────────────────────────────────

  describe('RT filtering', () => {
    it('filters out retweets that start with "RT @"', async () => {
      const dir = archive([
        makeTweet({ id_str: '1', full_text: 'RT @someone: Original tweet', created_at: T0 }),
      ])
      const chunks = await collect(adapter.adapt(dir))
      expect(chunks).toHaveLength(0)
    })

    it('keeps a tweet that mentions RT but does not start with "RT @"', async () => {
      const dir = archive([
        makeTweet({ full_text: 'Interesting RT @example caused a debate' }),
      ])
      const chunks = await collect(adapter.adapt(dir))
      expect(chunks).toHaveLength(1)
    })

    it('filters multiple RT tweets from a mixed set', async () => {
      const dir = archive([
        makeTweet({ id_str: '1', full_text: 'My own thought', created_at: T0 }),
        makeTweet({ id_str: '2', full_text: 'RT @x: something', created_at: T60 }),
        makeTweet({ id_str: '3', full_text: 'Another thought', created_at: T90 }),
      ])
      const chunks = await collect(adapter.adapt(dir))
      expect(chunks).toHaveLength(2)
    })
  })

  // ── pure-link filtering ────────────────────────────────────────────────────

  describe('pure-link filtering', () => {
    it('filters out tweets that contain only a URL', async () => {
      const dir = archive([
        makeTweet({ full_text: 'https://example.com/article' }),
      ])
      const chunks = await collect(adapter.adapt(dir))
      expect(chunks).toHaveLength(0)
    })

    it('filters out tweets with multiple URLs and no other text', async () => {
      const dir = archive([
        makeTweet({ full_text: 'https://a.com https://b.com' }),
      ])
      const chunks = await collect(adapter.adapt(dir))
      expect(chunks).toHaveLength(0)
    })

    it('keeps tweets that have text alongside a URL', async () => {
      const dir = archive([
        makeTweet({ full_text: 'Great article https://example.com' }),
      ])
      const chunks = await collect(adapter.adapt(dir))
      expect(chunks).toHaveLength(1)
    })
  })

  // ── thread merging (< 30 min gap) ──────────────────────────────────────────

  describe('thread merging', () => {
    it('merges two tweets posted within 30 minutes into one chunk', async () => {
      const dir = archive([
        makeTweet({ id_str: '1', full_text: 'First part', created_at: T0 }),
        makeTweet({ id_str: '2', full_text: 'Second part', created_at: T10 }),
      ])
      const chunks = await collect(adapter.adapt(dir))
      expect(chunks).toHaveLength(1)
      expect(chunks[0]!.content).toContain('First part')
      expect(chunks[0]!.content).toContain('Second part')
    })

    it('merges three consecutive tweets all within 30 min into one chunk', async () => {
      const dir = archive([
        makeTweet({ id_str: '1', full_text: 'Part 1', created_at: T0 }),
        makeTweet({ id_str: '2', full_text: 'Part 2', created_at: T10 }),
        makeTweet({ id_str: '3', full_text: 'Part 3', created_at: T20 }),
      ])
      const chunks = await collect(adapter.adapt(dir))
      expect(chunks).toHaveLength(1)
      expect(chunks[0]!.metadata?.is_thread).toBe(true)
    })

    it('sets is_thread to false for a single-tweet chunk', async () => {
      const dir = archive([
        makeTweet({ id_str: '1', full_text: 'Solo tweet', created_at: T0 }),
      ])
      const chunks = await collect(adapter.adapt(dir))
      expect(chunks[0]!.metadata?.is_thread).toBe(false)
    })

    it('records all tweet ids in a merged thread chunk', async () => {
      const dir = archive([
        makeTweet({ id_str: 'AAA', full_text: 'First', created_at: T0 }),
        makeTweet({ id_str: 'BBB', full_text: 'Second', created_at: T10 }),
      ])
      const chunks = await collect(adapter.adapt(dir))
      const ids = chunks[0]!.metadata?.tweet_ids as string[]
      expect(ids).toContain('AAA')
      expect(ids).toContain('BBB')
    })
  })

  // ── separate tweets (> 30 min gap) ────────────────────────────────────────

  describe('gap separation', () => {
    it('keeps tweets more than 30 minutes apart as separate chunks', async () => {
      const dir = archive([
        makeTweet({ id_str: '1', full_text: 'Morning thought', created_at: T0 }),
        makeTweet({ id_str: '2', full_text: 'Afternoon thought', created_at: T60 }),
      ])
      const chunks = await collect(adapter.adapt(dir))
      expect(chunks).toHaveLength(2)
    })

    it('produces correct chunk count for a mix of threaded and separated tweets', async () => {
      const dir = archive([
        // Thread: T0 + T10 → merged
        makeTweet({ id_str: '1', full_text: 'Thread A1', created_at: T0 }),
        makeTweet({ id_str: '2', full_text: 'Thread A2', created_at: T10 }),
        // Separate: T60 and T90 are both > 30 min from the previous one? No:
        // T10 → T60 = 50 min gap → separate; T60 → T90 = 30 min exactly → NOT < 30
        makeTweet({ id_str: '3', full_text: 'Standalone B', created_at: T60 }),
        makeTweet({ id_str: '4', full_text: 'Standalone C', created_at: T90 }),
      ])
      const chunks = await collect(adapter.adapt(dir))
      // chunk 1: [1,2] merged; chunk 2: [3]; chunk 3: [4]
      expect(chunks).toHaveLength(3)
    })

    it('uses the date of the first tweet for temporal metadata', async () => {
      const dir = archive([
        makeTweet({ id_str: '1', full_text: 'First', created_at: T0 }),
        makeTweet({ id_str: '2', full_text: 'Second', created_at: T10 }),
      ])
      const chunks = await collect(adapter.adapt(dir))
      expect(chunks[0]!.temporal).toEqual({
        date: new Date(T0).toISOString().slice(0, 10),
        confidence: 'exact',
      })
    })
  })

  // ── chunk metadata ─────────────────────────────────────────────────────────

  describe('chunk type assignment', () => {
    it('sets type to "opinion" for a standalone, non-reply tweet', async () => {
      const dir = archive([makeTweet({ full_text: 'My strong opinion here.' })])
      const chunks = await collect(adapter.adapt(dir))
      expect(chunks[0]!.type).toBe('opinion')
    })

    it('sets type to "casual" for a reply tweet', async () => {
      const dir = archive([
        makeTweet({
          full_text: 'Replying to you here.',
          in_reply_to_status_id_str: '999',
        }),
      ])
      const chunks = await collect(adapter.adapt(dir))
      expect(chunks[0]!.type).toBe('casual')
    })

    it('sets context to "public" for all twitter chunks', async () => {
      const dir = archive([makeTweet()])
      const chunks = await collect(adapter.adapt(dir))
      expect(chunks[0]!.context).toBe('public')
    })
  })
})
