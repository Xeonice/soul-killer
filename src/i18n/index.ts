import type { SupportedLanguage } from '../config/schema.js'
import zh from './locales/zh.json' with { type: 'json' }
import ja from './locales/ja.json' with { type: 'json' }
import en from './locales/en.json' with { type: 'json' }

const locales: Record<SupportedLanguage, Record<string, string>> = { zh, ja, en }

let currentLocale: SupportedLanguage = 'zh'

export function setLocale(locale: SupportedLanguage): void {
  currentLocale = locale
}

export function getLocale(): SupportedLanguage {
  return currentLocale
}

export function t(key: string, params?: Record<string, string>): string {
  let text = locales[currentLocale][key] ?? key
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      text = text.replaceAll(`{${k}}`, v)
    }
  }
  return text
}
