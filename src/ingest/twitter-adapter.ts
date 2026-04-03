import fs from 'node:fs'
import crypto from 'node:crypto'
import type { SoulChunk, DataAdapter } from './types.js'

interface RawTweet {
  tweet: {
    id_str: string
    full_text: string
    created_at: string
    in_reply_to_status_id_str?: string
    entities?: {
      urls?: { expanded_url: string }[]
    }
  }
}

export class TwitterAdapter implements DataAdapter {
  name = 'twitter'

  async *adapt(archivePath: string): AsyncIterable<SoulChunk> {
    const tweets = parseTweetsJs(archivePath)
    const filtered = tweets.filter((t) => !isRT(t) && !isPureLink(t))
    const sorted = filtered.sort((a, b) =>
      new Date(a.tweet.created_at).getTime() - new Date(b.tweet.created_at).getTime()
    )

    const threads = mergeThreads(sorted)

    for (const thread of threads) {
      const content = thread.map((t) => t.tweet.full_text).join('\n\n')
      const firstTweet = thread[0]!
      const isReply = !!firstTweet.tweet.in_reply_to_status_id_str

      const tweetDate = new Date(firstTweet.tweet.created_at)

      yield {
        id: crypto.createHash('sha256').update(`tw:${firstTweet.tweet.id_str}`).digest('hex').slice(0, 16),
        source: 'twitter',
        content,
        timestamp: new Date().toISOString(),
        context: 'public',
        type: isReply ? 'casual' : 'opinion',
        metadata: {
          tweet_ids: thread.map((t) => t.tweet.id_str),
          is_thread: thread.length > 1,
          is_reply: isReply,
        },
        temporal: {
          date: tweetDate.toISOString().slice(0, 10),
          confidence: 'exact' as const,
        },
      }
    }
  }
}

function parseTweetsJs(archivePath: string): RawTweet[] {
  // Twitter archive format: window.YTD.tweet.part0 = [...]
  const tweetsJsPath = `${archivePath}/data/tweets.js`
  if (!fs.existsSync(tweetsJsPath)) {
    // Try alternative path
    const altPath = `${archivePath}/tweets.js`
    if (!fs.existsSync(altPath)) {
      throw new Error(`tweets.js not found in ${archivePath}`)
    }
    return parseTweetsFile(altPath)
  }
  return parseTweetsFile(tweetsJsPath)
}

function parseTweetsFile(filePath: string): RawTweet[] {
  let content = fs.readFileSync(filePath, 'utf-8')
  // Remove the JS assignment prefix
  const assignIdx = content.indexOf('[')
  if (assignIdx > 0) {
    content = content.slice(assignIdx)
  }
  return JSON.parse(content) as RawTweet[]
}

function isRT(tweet: RawTweet): boolean {
  return tweet.tweet.full_text.startsWith('RT @')
}

function isPureLink(tweet: RawTweet): boolean {
  const text = tweet.tweet.full_text.trim()
  // Remove URLs and check if anything meaningful remains
  const withoutUrls = text.replace(/https?:\/\/\S+/g, '').trim()
  return withoutUrls.length === 0
}

function mergeThreads(sorted: RawTweet[]): RawTweet[][] {
  const threads: RawTweet[][] = []
  let currentThread: RawTweet[] = []

  for (const tweet of sorted) {
    if (currentThread.length === 0) {
      currentThread.push(tweet)
      continue
    }

    const lastTweet = currentThread[currentThread.length - 1]!
    const lastTime = new Date(lastTweet.tweet.created_at).getTime()
    const currentTime = new Date(tweet.tweet.created_at).getTime()
    const gapMinutes = (currentTime - lastTime) / (1000 * 60)

    if (gapMinutes < 30) {
      currentThread.push(tweet)
    } else {
      threads.push(currentThread)
      currentThread = [tweet]
    }
  }

  if (currentThread.length > 0) {
    threads.push(currentThread)
  }

  return threads
}
