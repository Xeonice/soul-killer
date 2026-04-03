import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'

const LOG_DIR = path.join(os.homedir(), '.soulkiller')
const LOG_PATH = path.join(LOG_DIR, 'debug.log')

function ensureLogDir() {
  if (!fs.existsSync(LOG_DIR)) {
    fs.mkdirSync(LOG_DIR, { recursive: true })
  }
}

function timestamp(): string {
  return new Date().toISOString()
}

function append(level: string, ...args: unknown[]) {
  ensureLogDir()
  const msg = args.map((a) =>
    typeof a === 'string' ? a : a instanceof Error ? `${a.message}\n${a.stack}` : JSON.stringify(a)
  ).join(' ')
  fs.appendFileSync(LOG_PATH, `[${timestamp()}] [${level}] ${msg}\n`)
}

export const logger = {
  debug: (...args: unknown[]) => append('DEBUG', ...args),
  info: (...args: unknown[]) => append('INFO', ...args),
  warn: (...args: unknown[]) => append('WARN', ...args),
  error: (...args: unknown[]) => append('ERROR', ...args),
  /** Full path to the log file */
  path: LOG_PATH,
}
