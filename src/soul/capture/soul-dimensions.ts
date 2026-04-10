import type { DimensionDef, DimensionPlan as UnifiedDimensionPlan } from '../../infra/agent/dimension-framework.js'
import { signalsToRegex } from '../../infra/agent/dimension-framework.js'
import type { SupportedLanguage } from '../../config/schema.js'
import { getLocale } from '../../infra/i18n/index.js'

export type TargetClassification =
  | 'DIGITAL_CONSTRUCT'
  | 'PUBLIC_ENTITY'
  | 'HISTORICAL_RECORD'
  | 'UNKNOWN_ENTITY'

// ========== Legacy type aliases (for backward compat) ==========

export type SoulDimension = 'identity' | 'quotes' | 'expression' | 'thoughts' | 'behavior' | 'relations' | 'capabilities' | 'milestones'
export type DimensionPriority = 'required' | 'important' | 'supplementary'

// ========== Dimension Templates (unified DimensionDef interface) ==========

export const SOUL_DIMENSION_TEMPLATES: DimensionDef[] = [
  {
    name: 'identity',
    display: '身份',
    description: '身份背景、来历、所属世界/组织',
    priority: 'required',
    source: 'planned',
    signals: ['background', 'biography', 'born', 'origin', 'history', 'character profile', '是', '来自', '角色', '出身', '背景', '设定', '身份', '生平', '简介'],
    queries: ['{name} {origin} wiki', '{name} character background', '{name} character profile', '{localName} 角色介绍', '{localName} 人物设定'],
    distillTarget: 'lore',
    qualityCriteria: ['包含人物的背景、出身、经历等具体信息', '有传记性质的详细描述而非简单罗列'],
    minArticles: 3,
  },
  {
    name: 'quotes',
    display: '语录',
    description: '台词、语录、名言、口头禅、直接引用',
    priority: 'required',
    source: 'planned',
    signals: ['said', 'says', 'quote', 'famous line', 'famous word', '台词', '语录', '名言', '名句', '经典'],
    queries: ['{name} famous quotes', '{name} dialogue lines', '{localName} 经典台词', '{localName} 语录 名言'],
    distillTarget: 'lore',
    qualityCriteria: ['包含直接引用的原话或台词', '有语境说明（谁说的、什么场景）'],
    minArticles: 3,
  },
  {
    name: 'expression',
    display: '表达',
    description: '说话风格、语气、用词偏好、修辞习惯',
    priority: 'required',
    source: 'planned',
    signals: ['speech pattern', 'tone of', 'manner of speak', 'writing style', 'rhetoric', '口头禅', '语气', '说话', '用词', '修辞', '文风'],
    queries: ['{name} speech patterns', '{name} speaking style', '{localName} 说话风格', '{localName} 口头禅 语气'],
    distillTarget: 'lore',
    qualityCriteria: ['分析说话风格、语气特征', '有具体的语言示例'],
    minArticles: 3,
  },
  {
    name: 'thoughts',
    display: '思想',
    description: '价值观、信念、立场、人生哲学',
    priority: 'important',
    source: 'planned',
    signals: ['believes', 'values', 'philosophy', 'ideology', 'opinion', 'stance', 'worldview', '观点', '信念', '价值观', '理念', '世界观', '立场', '信仰', '哲学', '主张'],
    queries: ['{name} beliefs motivation', '{name} values philosophy', '{localName} 价值观 信念', '{localName} 理想 动机'],
    distillTarget: 'lore',
    qualityCriteria: ['阐述价值观、信念或哲学思想', '有深度分析而非表面描述'],
    minArticles: 2,
  },
  {
    name: 'behavior',
    display: '行为',
    description: '决策模式、面对冲突的反应、习惯性行为',
    priority: 'important',
    source: 'planned',
    signals: ['decision', 'reaction', 'habit', 'pattern', 'temperament', 'personality', 'MBTI', 'behavior', '性格', '行为', '决策', '反应', '脾气', '习惯', '处事', '作风'],
    queries: ['{name} personality analysis', '{name} decision patterns', '{localName} 性格分析', '{localName} 行为模式'],
    distillTarget: 'lore',
    qualityCriteria: ['描述行为模式或决策过程', '有具体事例支撑'],
    minArticles: 2,
  },
  {
    name: 'relations',
    display: '关系',
    description: '重要关系、对不同人的态度、社交风格',
    priority: 'supplementary',
    source: 'planned',
    signals: ['relationship', 'friend', 'rival', 'ally', 'partner', 'mentor', 'enemy', '关系', '朋友', '对手', '伙伴', '师徒', '敌人', '恋人', '同伴', '交往'],
    queries: ['{name} {origin} relationships', '{name} key allies rivals', '{localName} 人物关系'],
    distillTarget: 'lore',
    qualityCriteria: ['描述与他人的具体关系', '分析关系动态'],
    minArticles: 2,
  },
  {
    name: 'capabilities',
    display: '能力',
    description: '能力、技能、属性数值、装备、专业知识',
    priority: 'important',
    source: 'planned',
    signals: ['abilities', 'powers', 'skills', 'stats', 'weapons', 'equipment', 'noble phantasm', 'magic', 'technique', '能力', '技能', '属性', '宝具', '武器', '装备', '法术', '专精', '方法论', '战斗风格'],
    queries: ['{name} abilities powers', '{name} skills stats', '{name} weapons equipment', '{localName} 能力 技能', '{localName} 武器 装备'],
    distillTarget: 'lore',
    qualityCriteria: ['描述具体能力或技能', '有数值或等级信息'],
    minArticles: 2,
  },
  {
    name: 'milestones',
    display: '里程碑',
    description: '关键事件时间线、转折点、成长阶段、标志性成就',
    priority: 'important',
    source: 'planned',
    signals: ['timeline', 'key event', 'turning point', 'milestone', 'major battle', 'story arc', 'chronolog', '时间线', '关键事件', '转折点', '里程碑', '重大战役', '经历', '编年', '大事记'],
    queries: ['{name} timeline key events', '{name} story arc', '{name} {origin} major battles', '{localName} 关键事件', '{localName} 经历 转折点'],
    distillTarget: 'lore',
    qualityCriteria: ['包含关键事件的时间线', '有因果分析'],
    minArticles: 2,
  },
]

// ========== Localized display/description/qualityCriteria ==========

interface LocalizedDimensionStrings {
  display: Record<SupportedLanguage, string>
  description: Record<SupportedLanguage, string>
  qualityCriteria: Record<SupportedLanguage, string[]>
}

const SOUL_DIMENSION_L10N: Record<string, LocalizedDimensionStrings> = {
  identity: {
    display: { zh: '身份', en: 'Identity', ja: 'アイデンティティ' },
    description: {
      zh: '身份背景、来历、所属世界/组织',
      en: 'Background, origin, affiliated world/organization',
      ja: '身元・出自・所属する世界/組織',
    },
    qualityCriteria: {
      zh: ['包含人物的背景、出身、经历等具体信息', '有传记性质的详细描述而非简单罗列'],
      en: ['Contains specific background, origin, and experience details', 'Has biographical depth rather than simple enumeration'],
      ja: ['人物の背景・出自・経歴などの具体的情報を含む', '単なる列挙ではなく伝記的な詳細記述がある'],
    },
  },
  quotes: {
    display: { zh: '语录', en: 'Quotes', ja: '語録' },
    description: {
      zh: '台词、语录、名言、口头禅、直接引用',
      en: 'Dialogue lines, quotes, famous sayings, catchphrases, direct citations',
      ja: 'セリフ・語録・名言・口癖・直接引用',
    },
    qualityCriteria: {
      zh: ['包含直接引用的原话或台词', '有语境说明（谁说的、什么场景）'],
      en: ['Contains directly quoted speech or dialogue', 'Has context (who said it, in what scene)'],
      ja: ['直接引用された原文やセリフを含む', '文脈の説明がある（誰が、どの場面で）'],
    },
  },
  expression: {
    display: { zh: '表达', en: 'Expression', ja: '表現' },
    description: {
      zh: '说话风格、语气、用词偏好、修辞习惯',
      en: 'Speech style, tone, word preferences, rhetorical habits',
      ja: '話し方・語調・用語の好み・修辞的癖',
    },
    qualityCriteria: {
      zh: ['分析说话风格、语气特征', '有具体的语言示例'],
      en: ['Analyzes speech style and tonal characteristics', 'Includes specific language examples'],
      ja: ['話し方や語調の特徴を分析している', '具体的な言語例がある'],
    },
  },
  thoughts: {
    display: { zh: '思想', en: 'Thoughts', ja: '思想' },
    description: {
      zh: '价值观、信念、立场、人生哲学',
      en: 'Values, beliefs, stances, life philosophy',
      ja: '価値観・信念・立場・人生哲学',
    },
    qualityCriteria: {
      zh: ['阐述价值观、信念或哲学思想', '有深度分析而非表面描述'],
      en: ['Expounds values, beliefs, or philosophical ideas', 'Has depth of analysis rather than surface description'],
      ja: ['価値観・信念・哲学的思想を論じている', '表面的な記述ではなく深い分析がある'],
    },
  },
  behavior: {
    display: { zh: '行为', en: 'Behavior', ja: '行動' },
    description: {
      zh: '决策模式、面对冲突的反应、习惯性行为',
      en: 'Decision patterns, conflict responses, habitual behavior',
      ja: '意思決定パターン・対立時の反応・習慣的行動',
    },
    qualityCriteria: {
      zh: ['描述行为模式或决策过程', '有具体事例支撑'],
      en: ['Describes behavioral patterns or decision processes', 'Supported by concrete examples'],
      ja: ['行動パターンや意思決定過程を記述している', '具体的な事例で裏付けされている'],
    },
  },
  relations: {
    display: { zh: '关系', en: 'Relations', ja: '関係' },
    description: {
      zh: '重要关系、对不同人的态度、社交风格',
      en: 'Key relationships, attitudes toward others, social style',
      ja: '重要な関係・他者への態度・社交スタイル',
    },
    qualityCriteria: {
      zh: ['描述与他人的具体关系', '分析关系动态'],
      en: ['Describes specific relationships with others', 'Analyzes relationship dynamics'],
      ja: ['他者との具体的な関係を描写している', '関係性のダイナミクスを分析している'],
    },
  },
  capabilities: {
    display: { zh: '能力', en: 'Capabilities', ja: '能力' },
    description: {
      zh: '能力、技能、属性数值、装备、专业知识',
      en: 'Abilities, skills, stat attributes, equipment, expertise',
      ja: '能力・スキル・ステータス・装備・専門知識',
    },
    qualityCriteria: {
      zh: ['描述具体能力或技能', '有数值或等级信息'],
      en: ['Describes specific abilities or skills', 'Includes numerical or rank information'],
      ja: ['具体的な能力やスキルを記述している', '数値やランク情報を含む'],
    },
  },
  milestones: {
    display: { zh: '里程碑', en: 'Milestones', ja: 'マイルストーン' },
    description: {
      zh: '关键事件时间线、转折点、成长阶段、标志性成就',
      en: 'Key event timeline, turning points, growth stages, landmark achievements',
      ja: '重要イベントのタイムライン・転換点・成長段階・画期的な成果',
    },
    qualityCriteria: {
      zh: ['包含关键事件的时间线', '有因果分析'],
      en: ['Contains a timeline of key events', 'Has causal analysis'],
      ja: ['重要イベントのタイムラインを含む', '因果分析がある'],
    },
  },
}

/**
 * Get soul dimension templates localized to the specified language.
 * Falls back to current locale if no language specified.
 */
export function getLocalizedSoulDimensions(lang?: SupportedLanguage): DimensionDef[] {
  const language = lang ?? getLocale()
  return SOUL_DIMENSION_TEMPLATES.map((dim) => {
    const l10n = SOUL_DIMENSION_L10N[dim.name]
    if (!l10n) return dim
    return {
      ...dim,
      display: l10n.display[language],
      description: l10n.description[language],
      qualityCriteria: l10n.qualityCriteria[language],
    }
  })
}

// ========== Backward compat alias ==========
export const SOUL_BASE_DIMENSIONS = SOUL_DIMENSION_TEMPLATES

// ========== Legacy exports (backward compat) ==========

export const ALL_DIMENSIONS: SoulDimension[] = SOUL_DIMENSION_TEMPLATES.map((d) => d.name as SoulDimension)
export const REQUIRED_DIMENSIONS: SoulDimension[] = SOUL_DIMENSION_TEMPLATES.filter((d) => d.priority === 'required').map((d) => d.name as SoulDimension)

/** Legacy DIMENSIONS record - derived from SOUL_DIMENSION_TEMPLATES */
export const DIMENSIONS: Record<SoulDimension, { priority: DimensionPriority; description: string; distillTarget: string }> = Object.fromEntries(
  SOUL_DIMENSION_TEMPLATES.map((d) => [d.name, { priority: d.priority, description: d.description, distillTarget: d.distillTarget }]),
) as any

/** Legacy DIMENSION_SIGNALS - derived from SOUL_DIMENSION_TEMPLATES */
export const DIMENSION_SIGNALS: Record<SoulDimension, RegExp[]> = Object.fromEntries(
  SOUL_DIMENSION_TEMPLATES.map((d) => [d.name, signalsToRegex(d.signals)]),
) as any

// ========== Search Plan Generation ==========

export interface DimensionPlan {
  dimension: SoulDimension
  priority: DimensionPriority
  queries: string[]
}

export interface SearchPlan {
  classification: TargetClassification
  englishName: string
  dimensions: DimensionPlan[]
}

const TAG_ENHANCED_DIMENSIONS: Set<SoulDimension> = new Set(['capabilities', 'milestones', 'thoughts', 'behavior'])

export function generateSearchPlan(
  classification: TargetClassification,
  englishName: string,
  localName: string,
  origin: string,
  tags?: { domain?: string[] },
): SearchPlan {
  if (classification === 'UNKNOWN_ENTITY') {
    return { classification, englishName, dimensions: [] }
  }

  const effectiveLocalName = localName && localName !== englishName ? localName : englishName
  const tagHint = tags?.domain?.length ? tags.domain.join(' ') : ''

  const dimensions: DimensionPlan[] = SOUL_DIMENSION_TEMPLATES.map((dimDef) => {
    const baseQueries = dimDef.queries.map((t) =>
      t.replace(/\{name\}/g, englishName)
       .replace(/\{localName\}/g, effectiveLocalName)
       .replace(/\{origin\}/g, origin),
    )

    if (tagHint && TAG_ENHANCED_DIMENSIONS.has(dimDef.name as SoulDimension)) {
      const tagQueries = baseQueries.map((q) => `${q} ${tagHint}`)
      return {
        dimension: dimDef.name as SoulDimension,
        priority: dimDef.priority,
        queries: [...baseQueries, ...tagQueries],
      }
    }

    return {
      dimension: dimDef.name as SoulDimension,
      priority: dimDef.priority,
      queries: baseQueries,
    }
  })

  return { classification, englishName, dimensions }
}

// ========== Coverage Analysis (unified, works with any DimensionDef[]) ==========

export interface DimensionCoverage {
  count: number
  covered: boolean
}

export interface CoverageReport {
  coverage: Record<string, DimensionCoverage>
  totalCovered: number
  requiredCovered: number
  canReport: boolean
  suggestion: string
}

const MIN_TOTAL_COVERED = 4
const MIN_REQUIRED_COVERED = 2

/**
 * Analyze coverage using a DimensionPlan (dynamic dimensions).
 * Falls back to SOUL_BASE_DIMENSIONS if no plan provided.
 */
export function analyzeCoverageWithPlan(extractions: { content: string }[], dims: DimensionDef[]): CoverageReport {
  const coverage: Record<string, DimensionCoverage> = {}
  for (const dim of dims) {
    coverage[dim.name] = { count: 0, covered: false }
  }

  for (const ext of extractions) {
    for (const dim of dims) {
      const patterns = signalsToRegex(dim.signals)
      if (patterns.some((p) => p.test(ext.content))) {
        coverage[dim.name]!.count++
      }
    }
  }

  for (const dim of dims) {
    coverage[dim.name]!.covered = coverage[dim.name]!.count > 0
  }

  const totalCovered = dims.filter((d) => coverage[d.name]!.covered).length
  const requiredDims = dims.filter((d) => d.priority === 'required')
  const requiredCovered = requiredDims.filter((d) => coverage[d.name]!.covered).length
  const canReport = totalCovered >= MIN_TOTAL_COVERED && requiredCovered >= MIN_REQUIRED_COVERED

  const missing = dims.filter((d) => !coverage[d.name]!.covered)
  let suggestion: string
  if (canReport && missing.length === 0) {
    suggestion = 'All dimensions covered. Ready to report.'
  } else if (canReport) {
    const missingDesc = missing.map((d) => `${d.name} (${d.description})`).join(', ')
    suggestion = `Coverage sufficient to report. Still missing: ${missingDesc}`
  } else {
    const missingRequired = requiredDims.filter((d) => !coverage[d.name]!.covered)
    const missingDesc = missingRequired.map((d) => `${d.name} (${d.description})`).join(', ')
    suggestion = `Not enough coverage. Missing required dimensions: ${missingDesc}. Search for these before reporting.`
  }

  return { coverage, totalCovered, requiredCovered, canReport, suggestion }
}

/** Legacy: analyze coverage with base dimensions only */
export function analyzeCoverage(extractions: { content: string }[]): CoverageReport {
  return analyzeCoverageWithPlan(extractions, SOUL_DIMENSION_TEMPLATES)
}
