import type { TagSet } from '../soul/tags/taxonomy.js'

export interface TemplateContext {
  soul: {
    name: string
    display_name: string
    identity: string
    tags: TagSet
  }
  world: {
    name: string
    display_name: string
  }
  entries: Record<string, string>
}

const MAX_DEPTH = 3

export function renderTemplate(
  template: string,
  context: TemplateContext,
  depth: number = 0,
): string {
  if (depth >= MAX_DEPTH) return template

  // Process {{#if condition}}...{{/if}} blocks
  let result = processConditionals(template, context)

  // Process {{variable}} interpolation
  result = result.replace(/\{\{([^#/}][^}]*)\}\}/g, (_match, expr: string) => {
    const trimmed = expr.trim()
    const value = resolveValue(trimmed, context, depth)
    return value ?? ''
  })

  return result
}

function processConditionals(template: string, context: TemplateContext): string {
  // Match {{#if condition}}...{{/if}} — non-greedy, non-nested
  const ifPattern = /\{\{#if\s+([^}]+)\}\}([\s\S]*?)\{\{\/if\}\}/g

  return template.replace(ifPattern, (_match, condition: string, body: string) => {
    const value = resolveValue(condition.trim(), context, MAX_DEPTH)
    if (value && value !== '' && value !== 'false' && value !== 'undefined') {
      return body
    }
    return ''
  })
}

function resolveValue(
  path: string,
  context: TemplateContext,
  depth: number,
): string | undefined {
  // Handle entries.* references with recursive rendering
  if (path.startsWith('entries.')) {
    const entryName = path.slice('entries.'.length)
    const content = context.entries[entryName]
    if (content === undefined) return undefined
    if (depth + 1 >= MAX_DEPTH) return content
    return renderTemplate(content, context, depth + 1)
  }

  // Resolve dotted path on context object
  const parts = path.split('.')
  let current: unknown = context

  for (const part of parts) {
    if (current === null || current === undefined) return undefined
    if (typeof current === 'object') {
      current = (current as Record<string, unknown>)[part]
    } else {
      return undefined
    }
  }

  if (current === null || current === undefined) return undefined
  if (typeof current === 'string') return current
  if (typeof current === 'number' || typeof current === 'boolean') return String(current)
  if (Array.isArray(current)) return current.join(', ')
  return undefined
}
