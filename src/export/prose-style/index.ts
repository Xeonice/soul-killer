/**
 * Prose style anchor — 故事级叙事风格锚点系统的入口。
 *
 * 该模块导出：
 * 1. 通用中文翻译腔反例库 (ZH_TRANSLATESE_PATTERNS)
 * 2. ProseStyleForbiddenPattern 类型
 * 3. 将反例库渲染为 LLM 可读文本的辅助函数
 *
 * 使用方：
 * - `src/agent/export-agent.ts` — set_prose_style 工具 description 通过
 *   `formatPatternsForToolDescription()` 动态 inline 反例库
 * - `src/export/story-spec.ts` — formatProseStyleSection 使用反例库作为
 *   fallback 渲染源（当 export 的 StorySpecConfig 缺 prose_style 时）
 * - `src/export/skill-template.ts` — SKILL.md fallback 分支 inline 5 条
 *   最高频反例
 */

export {
  ZH_TRANSLATESE_PATTERNS,
  type ProseStyleForbiddenPattern,
} from './zh-translatese-patterns.js'

import {
  ZH_TRANSLATESE_PATTERNS,
  type ProseStyleForbiddenPattern,
} from './zh-translatese-patterns.js'

/**
 * 把反例库渲染为 LLM 可读文本，用于 set_prose_style 工具 description。
 *
 * 输出格式（每条一段）：
 * ```
 * [id: degree_clause]
 *   ✗ 反例：...
 *   ✓ 正例：...
 *   理由：...
 * ```
 *
 * 该函数是反例库的唯一规范渲染入口。以后反例库扩展、改版，
 * 所有 consumer 都通过这个函数拿到最新内容，不会出现硬编码漂移。
 */
export function formatPatternsForToolDescription(
  patterns: ProseStyleForbiddenPattern[] = ZH_TRANSLATESE_PATTERNS,
): string {
  return patterns
    .map(
      (p) =>
        `[id: ${p.id}]\n` +
        `  ✗ 反例：${p.bad}\n` +
        `  ✓ 正例：${p.good}\n` +
        `  理由：${p.reason}`,
    )
    .join('\n\n')
}

/**
 * 返回反例库的前 N 条最高频条目，用于 SKILL.md fallback 分支的内嵌清单。
 * 默认 5 条。反例库按频率从高到低排序，前 N 条就是最高频子集。
 */
export function topForbiddenPatterns(
  n = 5,
  patterns: ProseStyleForbiddenPattern[] = ZH_TRANSLATESE_PATTERNS,
): ProseStyleForbiddenPattern[] {
  return patterns.slice(0, n)
}
