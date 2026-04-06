import type { EntryScope } from '../world/entry.js'

// ========== Type System ==========

export type WorldType = 'fictional-existing' | 'fictional-original' | 'real'

export type WorldClassification =
  | 'FICTIONAL_UNIVERSE'
  | 'REAL_SETTING'
  | 'UNKNOWN_SETTING'

// ========== Dimension Model ==========

export type WorldDimension =
  | 'geography'
  | 'history'
  | 'factions'
  | 'systems'
  | 'society'
  | 'culture'
  | 'species'
  | 'figures'
  | 'atmosphere'

export type WorldDimensionPriority = 'required' | 'important' | 'supplementary'

export interface WorldDimensionDef {
  priority: WorldDimensionPriority
  description: string
  distillTarget: EntryScope
}

export const WORLD_DIMENSIONS: Record<WorldDimension, WorldDimensionDef> = {
  geography:  { priority: 'required',      description: '空间：地点、地标、区域划分、空间结构',       distillTarget: 'background' },
  history:    { priority: 'required',      description: '时间：编年、关键事件、起源、纪元划分',       distillTarget: 'background' },
  factions:   { priority: 'required',      description: '势力：组织、阵营、政治结构、权力关系',       distillTarget: 'lore' },
  systems:    { priority: 'important',     description: '体系：科技/魔法、法律、治理、经济基础设施',   distillTarget: 'rule' },
  society:    { priority: 'important',     description: '社会：日常生活、阶层、生存方式、经济运转',    distillTarget: 'lore' },
  culture:    { priority: 'important',     description: '文化：习俗、信仰、语言、艺术、价值观',       distillTarget: 'lore' },
  species:    { priority: 'important',     description: '族群：种族、居民类型、存��类别��群体��征',    distillTarget: 'lore' },
  figures:    { priority: 'supplementary', description: '人物：关键角色、标志性人物、世界的定义��',    distillTarget: 'lore' },
  atmosphere: { priority: 'supplementary', description: '氛围：叙事基调、情���色彩、感官特征',         distillTarget: 'atmosphere' },
}

export const ALL_WORLD_DIMENSIONS: WorldDimension[] = [
  'geography', 'history', 'factions', 'systems', 'society', 'culture', 'species', 'figures', 'atmosphere',
]

export const REQUIRED_WORLD_DIMENSIONS: WorldDimension[] = ALL_WORLD_DIMENSIONS.filter(
  (d) => WORLD_DIMENSIONS[d].priority === 'required',
)

// ========== Dimension Signals (for coverage analysis) ==========

export const WORLD_DIMENSION_SIGNALS: Record<WorldDimension, RegExp[]> = {
  geography: [
    /\b(?:map|location|district|region|city|continent|planet|territory)\b/i,
    /地图|地点|区域|地标|城市|大陆|星球|领地|位于|坐落/,
  ],
  history: [
    /\b(?:timeline|history|chronolog|era|epoch|war|event|founded|origin)\b/i,
    /历史|编年|纪元|战争|事件|创立|起源|年代|时间线/,
  ],
  factions: [
    /\b(?:faction|organization|group|alliance|corporation|guild|party|government)\b/i,
    /势力|组织|阵营|联盟|公司|帮��|政府|派系|部门|团体/,
  ],
  systems: [
    /\b(?:technology|magic|system|law|rule|mechanic|infrastructure|economy)\b/i,
    /科技|魔法|体系|法律|规则|机制|基础设施|经济|法则|制度/,
  ],
  society: [
    /\b(?:daily\s+life|class|social|poverty|wealth|survival|living|wage|work)\b/i,
    /日常|阶层|社会|贫富|生存|生活|工资|打工|阶级|民生/,
  ],
  culture: [
    /\b(?:custom|tradition|religion|art|language|belief|value|ritual|festival)\b/i,
    /习俗|传统|信仰|艺术|语言|价值观|仪式|节日|文化|宗教/,
  ],
  species: [
    /\b(?:race|species|tribe|clan|elf|dwarf|human|creature|inhabitant|people)\b/i,
    /种族|族群|部族|精灵|矮人|人类|生物|居民|物种|族裔/,
  ],
  figures: [
    /\b(?:leader|founder|hero|villain|key\s+figure|notable|famous|prominent)\b/i,
    /领袖|创始人|英雄|反派|关键人物|著名|标志性|代表���物/,
  ],
  atmosphere: [
    /\b(?:atmosphere|mood|tone|aesthetic|vibe|feeling|ambiance|dark|grim)\b/i,
    /氛围|基调|情绪|美学|风格|感觉|格调|气氛/,
  ],
}

// ========== Search Templates ==========

type WorldDimensionTemplates = Record<WorldDimension, string[]>

const FICTIONAL_UNIVERSE_TEMPLATES: WorldDimensionTemplates = {
  geography: [
    '{name} map locations districts regions',
    '{name} wiki geography world',
    '{localName} 地图 地点 区域',
  ],
  history: [
    '{name} timeline history events lore',
    '{name} wiki chronology',
    '{localName} 历史 时间线 大事件',
  ],
  factions: [
    '{name} factions organizations groups',
    '{name} wiki corporations gangs political',
    '{localName} 势力 组织 阵营 派系',
  ],
  systems: [
    '{name} technology magic system rules mechanics',
    '{name} wiki how it works science',
    '{localName} 科技 体系 法则 系统 规则',
  ],
  society: [
    '{name} economy daily life social structure',
    '{name} wiki society class living',
    '{localName} 经济 社会 日常 阶层 生活',
  ],
  culture: [
    '{name} customs religion language art traditions',
    '{name} wiki culture beliefs values',
    '{localName} 文化 习俗 信仰 语言 艺术',
  ],
  species: [
    '{name} races species inhabitants creatures',
    '{name} wiki races types beings',
    '{localName} 种族 物种 居民 族群',
  ],
  figures: [
    '{name} key characters important figures',
    '{name} wiki notable characters protagonists',
    '{localName} 关键人物 重要���色 代表人物',
  ],
  atmosphere: [
    '{name} aesthetic mood tone atmosphere',
    '{name} vibe feeling art style',
    '{localName} 氛围 风格 美学 基调',
  ],
}

const REAL_SETTING_TEMPLATES: WorldDimensionTemplates = {
  geography: [
    '{name} geography locations landmarks layout',
    '{localName} 地理 地标 布局',
  ],
  history: [
    '{name} history timeline milestones',
    '{localName} 历史 里程碑 大事件',
  ],
  factions: [
    '{name} organizations departments structure',
    '{localName} 组织 部门 结构 权力',
  ],
  systems: [
    '{name} systems processes rules infrastructure',
    '{localName} 制度 流程 规则 基础设施',
  ],
  society: [
    '{name} daily life working conditions social dynamics',
    '{localName} 日常 生活 工作 社会 阶层',
  ],
  culture: [
    '{name} culture values traditions customs',
    '{localName} 文化 价值观 传统 习惯',
  ],
  species: [
    '{name} demographics population types roles',
    '{localName} 人口 群体 类型 角色',
  ],
  figures: [
    '{name} key figures founders leaders',
    '{localName} 关键人物 创始人 领袖',
  ],
  atmosphere: [
    '{name} atmosphere vibe feeling environment',
    '{localName} 氛围 感觉 环境 气质',
  ],
}

const WORLD_TEMPLATES_BY_CLASSIFICATION: Record<Exclude<WorldClassification, 'UNKNOWN_SETTING'>, WorldDimensionTemplates> = {
  FICTIONAL_UNIVERSE: FICTIONAL_UNIVERSE_TEMPLATES,
  REAL_SETTING: REAL_SETTING_TEMPLATES,
}

// ========== Search Plan Generation ==========

export interface WorldDimensionPlan {
  dimension: WorldDimension
  priority: WorldDimensionPriority
  queries: string[]
}

export interface WorldSearchPlan {
  classification: WorldClassification
  englishName: string
  dimensions: WorldDimensionPlan[]
}

export function generateWorldSearchPlan(
  classification: WorldClassification,
  englishName: string,
  localName: string,
  origin: string,
): WorldSearchPlan {
  if (classification === 'UNKNOWN_SETTING') {
    return { classification, englishName, dimensions: [] }
  }

  const templates = WORLD_TEMPLATES_BY_CLASSIFICATION[classification]
  const effectiveLocalName = localName && localName !== englishName ? localName : englishName

  const dimensions: WorldDimensionPlan[] = ALL_WORLD_DIMENSIONS.map((dim) => ({
    dimension: dim,
    priority: WORLD_DIMENSIONS[dim].priority,
    queries: templates[dim].map((t) =>
      t.replace(/\{name\}/g, englishName)
       .replace(/\{localName\}/g, effectiveLocalName)
       .replace(/\{origin\}/g, origin),
    ),
  }))

  return { classification, englishName, dimensions }
}

// ========== Coverage Analysis ==========

export interface WorldDimensionCoverage {
  count: number
  covered: boolean
}

export interface WorldCoverageReport {
  coverage: Record<WorldDimension, WorldDimensionCoverage>
  totalCovered: number
  requiredCovered: number
  canReport: boolean
  suggestion: string
}

const MIN_WORLD_TOTAL_COVERED = 4
const MIN_WORLD_REQUIRED_COVERED = 2

export function analyzeWorldCoverage(extractions: { content: string }[]): WorldCoverageReport {
  const coverage: Record<WorldDimension, WorldDimensionCoverage> = {} as any

  for (const dim of ALL_WORLD_DIMENSIONS) {
    coverage[dim] = { count: 0, covered: false }
  }

  for (const ext of extractions) {
    for (const dim of ALL_WORLD_DIMENSIONS) {
      const signals = WORLD_DIMENSION_SIGNALS[dim]
      if (signals.some((pattern) => pattern.test(ext.content))) {
        coverage[dim]!.count++
      }
    }
  }

  for (const dim of ALL_WORLD_DIMENSIONS) {
    coverage[dim]!.covered = coverage[dim]!.count > 0
  }

  const totalCovered = ALL_WORLD_DIMENSIONS.filter((d) => coverage[d]!.covered).length
  const requiredCovered = REQUIRED_WORLD_DIMENSIONS.filter((d) => coverage[d]!.covered).length
  const canReport = totalCovered >= MIN_WORLD_TOTAL_COVERED && requiredCovered >= MIN_WORLD_REQUIRED_COVERED

  const missing = ALL_WORLD_DIMENSIONS.filter((d) => !coverage[d]!.covered)
  let suggestion: string
  if (canReport && missing.length === 0) {
    suggestion = 'All dimensions covered. Ready to report.'
  } else if (canReport) {
    const missingDesc = missing.map((d) => `${d} (${WORLD_DIMENSIONS[d].description})`).join(', ')
    suggestion = `Coverage sufficient to report. Still missing: ${missingDesc}`
  } else {
    const missingRequired = REQUIRED_WORLD_DIMENSIONS.filter((d) => !coverage[d]!.covered)
    const missingDesc = missingRequired.map((d) => `${d} (${WORLD_DIMENSIONS[d].description})`).join(', ')
    suggestion = `Not enough coverage. Missing required dimensions: ${missingDesc}. Search for these before reporting.`
  }

  return { coverage, totalCovered, requiredCovered, canReport, suggestion }
}
