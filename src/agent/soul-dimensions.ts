export type TargetClassification =
  | 'DIGITAL_CONSTRUCT'
  | 'PUBLIC_ENTITY'
  | 'HISTORICAL_RECORD'
  | 'UNKNOWN_ENTITY'

// ========== Dimension Model ==========

export type SoulDimension = 'identity' | 'quotes' | 'expression' | 'thoughts' | 'behavior' | 'relations' | 'capabilities' | 'milestones'

export type DimensionPriority = 'required' | 'important' | 'supplementary'

export interface DimensionDef {
  priority: DimensionPriority
  description: string
  distillTarget: string
}

export const DIMENSIONS: Record<SoulDimension, DimensionDef> = {
  identity:   { priority: 'required',      description: '身份背景、来历、所属世界/组织', distillTarget: 'identity.md' },
  quotes:     { priority: 'required',      description: '台词、语录、名言、口头禅、直接引用', distillTarget: 'style.md' },
  expression: { priority: 'required',      description: '说话风格、语气、用词偏好、修辞习惯', distillTarget: 'style.md' },
  thoughts:   { priority: 'important',     description: '价值观、信念、立场、人生哲学', distillTarget: 'behaviors/' },
  behavior:   { priority: 'important',     description: '决策模式、面对冲突的反应、习惯性行为', distillTarget: 'behaviors/' },
  relations:     { priority: 'supplementary', description: '重要关系、对不同人的态度、社交风格', distillTarget: 'behaviors/' },
  capabilities:  { priority: 'important',     description: '能力、技能、属性数值、装备、专业知识', distillTarget: 'capabilities.md' },
  milestones:    { priority: 'important',     description: '关键事件时间线、转折点、成长阶段、标志性成就', distillTarget: 'milestones.md' },
}

export const ALL_DIMENSIONS: SoulDimension[] = ['identity', 'quotes', 'expression', 'thoughts', 'behavior', 'relations', 'capabilities', 'milestones']
export const REQUIRED_DIMENSIONS: SoulDimension[] = ALL_DIMENSIONS.filter((d) => DIMENSIONS[d].priority === 'required')

// ========== Dimension Signals (for coverage analysis) ==========

export const DIMENSION_SIGNALS: Record<SoulDimension, RegExp[]> = {
  identity: [
    /background|biography|born|origin|history|character\s+profile/i,
    /是|来自|角色|出身|背景|设定|身份|生平|简介/,
  ],
  quotes: [
    /"[^"]{10,}"|「[^」]{5,}」|'[^']{10,}'/,
    /\bsaid\b|\bsays\b|\bquote[ds]?\b|\bfamous\s+(?:line|word|saying)/i,
    /台词|语录|名言|名句|经典.*(?:台词|语录|话)/,
  ],
  expression: [
    /speech\s*pattern|tone\s+of|manner\s+of\s+speak|writing\s+style|rhetoric/i,
    /口头禅|语气|说话.*(?:方式|风格|特点)|用词|修辞|文风/,
  ],
  thoughts: [
    /\bbelieves?\b|\bvalues?\b|\bphilosophy\b|\bideolog/i,
    /\bopinion|stance|worldview|conviction/i,
    /观点|信念|价值观|理念|世界观|立场|信仰|哲学|主张/,
  ],
  behavior: [
    /\bdecision|react(?:ion)?|habit|pattern|temperament/i,
    /\bpersonality\b|\bMBTI\b|\bbehavior/i,
    /性格|行为|决策|反应|脾气|习惯|处事|作风/,
  ],
  relations: [
    /relationship|friend|rival|ally|partner|mentor|enemy/i,
    /关系|朋友|对手|伙伴|师徒|敌人|恋人|同伴|交往/,
  ],
  capabilities: [
    /abilities|powers|skills|stats|weapons|equipment|noble\s*phantasm|magic|spell|technique/i,
    /\bclass\s+skill|personal\s+skill|combat\s+style|fighting\s+style/i,
    /能力|技能|属性|宝具|武器|装备|法术|专精|方法论|战斗风格|义体|黑客/,
  ],
  milestones: [
    /timeline|key\s+events?|turning\s+point|milestone|major\s+battle|story\s+arc/i,
    /\bchronolog|biography.*event|career\s+highlight/i,
    /时间线|关键事件|转折点|里程碑|重大战役|经历|编年|大事记/,
  ],
}

// ========== Search Templates ==========

type DimensionTemplates = Record<SoulDimension, string[]>

const DIGITAL_CONSTRUCT_TEMPLATES: DimensionTemplates = {
  identity: [
    '{name} {origin} wiki',
    '{name} character profile',
    '{localName} 角色 设定 百科',
  ],
  quotes: [
    '{name} quotes dialogue lines',
    '{localName} 台词 语录 名言',
  ],
  expression: [
    '{name} speech patterns personality voice',
    '{localName} 说话风格 口头禅 语气',
  ],
  thoughts: [
    '{name} values beliefs ideals motivation',
    '{localName} 价值观 信念 理想',
  ],
  behavior: [
    '{name} personality analysis decisions',
    '{localName} 性格分析 行为模式',
  ],
  relations: [
    '{name} {origin} relationships characters',
    '{localName} 人物关系',
  ],
  capabilities: [
    '{name} abilities powers skills stats',
    '{name} weapons equipment noble phantasm',
    '{localName} 能力 技能 属性 宝具 武器',
  ],
  milestones: [
    '{name} timeline key events story arc',
    '{name} {origin} major battles turning points',
    '{localName} 时间线 关键事件 经历',
  ],
}

const PUBLIC_ENTITY_TEMPLATES: DimensionTemplates = {
  identity: [
    '{name} biography',
    '{localName} 生平 简介 百科',
  ],
  quotes: [
    '{name} famous quotes interviews',
    '{localName} 经典语录 发言',
  ],
  expression: [
    '{name} communication style speaking',
    '{localName} 说话风格 演讲特点',
  ],
  thoughts: [
    '{name} philosophy beliefs opinions',
    '{localName} 观点 立场 世界观',
  ],
  behavior: [
    '{name} leadership decision making style',
    '{localName} 处事方式 管理风格',
  ],
  relations: [
    '{name} key relationships collaborations',
    '{localName} 重要关系 合作',
  ],
  capabilities: [
    '{name} expertise methodology core skills',
    '{name} professional achievements key decisions',
    '{localName} 专业能力 方法论 核心技能',
  ],
  milestones: [
    '{name} career timeline key decisions milestones',
    '{name} major events turning points',
    '{localName} 生涯 时间线 关键决策',
  ],
}

const HISTORICAL_RECORD_TEMPLATES: DimensionTemplates = {
  identity: [
    '{name} biography legacy',
    '{localName} 生平 百科 传记',
  ],
  quotes: [
    '{name} famous quotes attributed sayings',
    '{localName} 名言 语录 格言',
  ],
  expression: [
    '{name} writing style rhetoric',
    '{localName} 文风 修辞 表达',
  ],
  thoughts: [
    '{name} philosophy core ideas contributions',
    '{localName} 思想 哲学 主张',
  ],
  behavior: [
    '{name} decisions historical accounts character',
    '{localName} 历史事迹 决策',
  ],
  relations: [
    '{name} contemporaries influence circle',
    '{localName} 交往 影响 人际',
  ],
  capabilities: [
    '{name} skills achievements expertise legacy',
    '{localName} 才能 成就 专长',
  ],
  milestones: [
    '{name} chronology major events legacy timeline',
    '{localName} 编年 大事记 历史事件',
  ],
}

const TEMPLATES_BY_CLASSIFICATION: Record<Exclude<TargetClassification, 'UNKNOWN_ENTITY'>, DimensionTemplates> = {
  DIGITAL_CONSTRUCT: DIGITAL_CONSTRUCT_TEMPLATES,
  PUBLIC_ENTITY: PUBLIC_ENTITY_TEMPLATES,
  HISTORICAL_RECORD: HISTORICAL_RECORD_TEMPLATES,
}

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

// Dimensions where domain tags are appended to search queries
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

  const templates = TEMPLATES_BY_CLASSIFICATION[classification]
  const effectiveLocalName = localName && localName !== englishName ? localName : englishName
  const tagHint = tags?.domain?.length ? tags.domain.join(' ') : ''

  const dimensions: DimensionPlan[] = ALL_DIMENSIONS.map((dim) => {
    const baseQueries = templates[dim].map((t) =>
      t.replace(/\{name\}/g, englishName)
       .replace(/\{localName\}/g, effectiveLocalName)
       .replace(/\{origin\}/g, origin),
    )

    // Append tag hint to queries for tag-enhanced dimensions
    if (tagHint && TAG_ENHANCED_DIMENSIONS.has(dim)) {
      const tagQueries = baseQueries.map((q) => `${q} ${tagHint}`)
      return {
        dimension: dim,
        priority: DIMENSIONS[dim].priority,
        queries: [...baseQueries, ...tagQueries],
      }
    }

    return {
      dimension: dim,
      priority: DIMENSIONS[dim].priority,
      queries: baseQueries,
    }
  })

  return { classification, englishName, dimensions }
}

// ========== Coverage Analysis ==========

export interface DimensionCoverage {
  count: number
  covered: boolean
}

export interface CoverageReport {
  coverage: Record<SoulDimension, DimensionCoverage>
  totalCovered: number
  requiredCovered: number
  canReport: boolean
  suggestion: string
}

const MIN_TOTAL_COVERED = 4
const MIN_REQUIRED_COVERED = 2

export function analyzeCoverage(extractions: { content: string }[]): CoverageReport {
  const coverage: Record<SoulDimension, DimensionCoverage> = {} as any

  for (const dim of ALL_DIMENSIONS) {
    coverage[dim] = { count: 0, covered: false }
  }

  for (const ext of extractions) {
    for (const dim of ALL_DIMENSIONS) {
      const signals = DIMENSION_SIGNALS[dim]
      if (signals.some((pattern) => pattern.test(ext.content))) {
        coverage[dim]!.count++
      }
    }
  }

  for (const dim of ALL_DIMENSIONS) {
    coverage[dim]!.covered = coverage[dim]!.count > 0
  }

  const totalCovered = ALL_DIMENSIONS.filter((d) => coverage[d]!.covered).length
  const requiredCovered = REQUIRED_DIMENSIONS.filter((d) => coverage[d]!.covered).length
  const canReport = totalCovered >= MIN_TOTAL_COVERED && requiredCovered >= MIN_REQUIRED_COVERED

  const missing = ALL_DIMENSIONS.filter((d) => !coverage[d]!.covered)
  let suggestion: string
  if (canReport && missing.length === 0) {
    suggestion = 'All dimensions covered. Ready to report.'
  } else if (canReport) {
    const missingDesc = missing.map((d) => `${d} (${DIMENSIONS[d].description})`).join(', ')
    suggestion = `Coverage sufficient to report. Still missing: ${missingDesc}`
  } else {
    const missingRequired = REQUIRED_DIMENSIONS.filter((d) => !coverage[d]!.covered)
    const missingDesc = missingRequired.map((d) => `${d} (${DIMENSIONS[d].description})`).join(', ')
    suggestion = `Not enough coverage. Missing required dimensions: ${missingDesc}. Search for these before reporting.`
  }

  return { coverage, totalCovered, requiredCovered, canReport, suggestion }
}
