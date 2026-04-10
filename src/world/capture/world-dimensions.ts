import type { EntryScope } from '../entry.js'
import type { DimensionDef } from '../../infra/agent/dimension-framework.js'
import { signalsToRegex } from '../../infra/agent/dimension-framework.js'
import type { SupportedLanguage } from '../../config/schema.js'
import { getLocale } from '../../infra/i18n/index.js'

// ========== Type System ==========

export type WorldType = 'fictional-existing' | 'fictional-original' | 'real'

export type WorldClassification =
  | 'FICTIONAL_UNIVERSE'
  | 'REAL_SETTING'
  | 'UNKNOWN_SETTING'

// ========== Legacy type aliases ==========

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

// ========== Shared meta-exclusion quality criterion ==========

const META_EXCLUSION_CRITERION: Record<SupportedLanguage, string> = {
  zh: '描述故事世界内部的事实，排除作品制作/发行/改编/播出/声优等 meta 信息',
  en: 'Describe facts internal to the story world; exclude production/release/adaptation/broadcast/voice actor meta information',
  ja: '物語世界内部の事実を記述し、制作/発行/改編/放送/声優などのメタ情報を排除する',
}

// Keep backward compat — the templates still use the zh string as default
const META_EXCLUSION_ZH = META_EXCLUSION_CRITERION.zh

// ========== Dimension Templates (unified DimensionDef interface) ==========

export const WORLD_DIMENSION_TEMPLATES: DimensionDef[] = [
  {
    name: 'geography',
    display: '地理',
    description: '空间：地点、地标、区域划分、空间结构',
    priority: 'required',
    source: 'planned',
    signals: ['map', 'location', 'district', 'region', 'city', 'continent', 'planet', 'territory', '地图', '地点', '区域', '地标', '城市', '大陆', '星球', '领地', '位于', '坐落'],
    queries: ['{name} map locations', '{name} districts regions', '{name} wiki geography', '{localName} 地图 地点', '{localName} 区域划分'],
    distillTarget: 'background',
    qualityCriteria: ['包含具体地点名称和位置描述', '有战略或历史意义的分析', META_EXCLUSION_ZH],
    minArticles: 3,
  },
  {
    name: 'history',
    display: '历史',
    description: '时间：编年、关键事件、起源、纪元划分',
    priority: 'required',
    source: 'planned',
    signals: ['timeline', 'history', 'chronolog', 'era', 'epoch', 'war', 'event', 'founded', 'origin', '历史', '编年', '纪元', '战争', '事件', '创立', '起源', '年代', '时间线'],
    queries: ['{name} timeline events', '{name} history lore', '{name} wiki chronology', '{localName} 历史 时间线', '{localName} 大事件', '{localName} 年表', 'timeline of {name}'],
    distillTarget: 'background',
    qualityCriteria: ['包含具体时间和事件', '有因果关系分析', META_EXCLUSION_ZH],
    minArticles: 3,
  },
  {
    name: 'factions',
    display: '势力',
    description: '势力：组织、阵营、政治结构、权力关系',
    priority: 'required',
    source: 'planned',
    signals: ['faction', 'organization', 'group', 'alliance', 'corporation', 'guild', 'party', 'government', '势力', '组织', '阵营', '联盟', '公司', '帮派', '政府', '派系', '部门', '团体'],
    queries: ['{name} major factions', '{name} political structure', '{name} organizations guilds', '{localName} 主要势力', '{localName} 政治结构'],
    distillTarget: 'lore',
    qualityCriteria: ['描述组织结构和权力关系', '有政策或治理方式的说明', META_EXCLUSION_ZH],
    minArticles: 3,
  },
  {
    name: 'systems',
    display: '体系',
    description: '体系：科技/魔法、法律、治理、经济基础设施',
    priority: 'important',
    source: 'planned',
    signals: ['technology', 'magic', 'system', 'law', 'rule', 'mechanic', 'infrastructure', 'economy', '科技', '魔法', '体系', '法律', '规则', '机制', '基础设施', '经济', '法则', '制度'],
    queries: ['{name} technology system', '{name} magic rules', '{name} game mechanics', '{localName} 科技体系', '{localName} 规则 法则'],
    distillTarget: 'rule',
    qualityCriteria: ['解释制度或体系的运作机制', '有历史渊源说明', META_EXCLUSION_ZH],
    minArticles: 2,
  },
  {
    name: 'society',
    display: '社会',
    description: '社会：日常生活、阶层、生存方式、经济运转',
    priority: 'important',
    source: 'planned',
    signals: ['daily life', 'class', 'social', 'poverty', 'wealth', 'survival', 'living', 'wage', 'work', '日常', '阶层', '社会', '贫富', '生存', '生活', '工资', '打工', '阶级', '民生'],
    queries: ['{name} daily life', '{name} social structure', '{name} economy classes', '{localName} 社会阶层', '{localName} 经济 日常'],
    distillTarget: 'lore',
    qualityCriteria: ['描述社会阶层或日常生活', '有具体的经济或民生数据', META_EXCLUSION_ZH],
    minArticles: 2,
  },
  {
    name: 'culture',
    display: '文化',
    description: '文化：习俗、信仰、语言、艺术、价值观',
    priority: 'important',
    source: 'planned',
    signals: ['custom', 'tradition', 'religion', 'art', 'language', 'belief', 'value', 'ritual', 'festival', '习俗', '传统', '信仰', '艺术', '语言', '价值观', '仪式', '节日', '文化', '宗教'],
    queries: ['{name} customs traditions', '{name} religion beliefs', '{name} language art', '{localName} 文化 习俗', '{localName} 信仰 价值观'],
    distillTarget: 'lore',
    qualityCriteria: ['描述文化特征或艺术成就', '有具体作品或人物举例', META_EXCLUSION_ZH],
    minArticles: 2,
  },
  {
    name: 'species',
    display: '族群',
    description: '族群：种族、居民类型、存在类别、群体特征',
    priority: 'important',
    source: 'planned',
    signals: ['race', 'species', 'tribe', 'clan', 'elf', 'dwarf', 'human', 'creature', 'inhabitant', 'people', '种族', '族群', '部族', '精灵', '矮人', '人类', '生物', '居民', '物种', '族裔'],
    queries: ['{name} races species', '{name} inhabitants creatures', '{localName} 种族 物种', '{localName} 居民 族群'],
    distillTarget: 'lore',
    qualityCriteria: ['描述族群特征或分布', '有人口或民族关系信息', META_EXCLUSION_ZH],
    minArticles: 2,
  },
  {
    name: 'figures',
    display: '人物',
    description: '人物：关键角色、标志性人物、世界的定义者',
    priority: 'supplementary',
    source: 'planned',
    signals: ['leader', 'founder', 'hero', 'villain', 'key figure', 'notable', 'famous', 'prominent', '领袖', '创始人', '英雄', '反派', '关键人物', '著名', '标志性', '代表人物'],
    queries: ['{name} key characters', '{name} notable protagonists', '{name} important figures', '{localName} 关键人物', '{localName} 重要角色'],
    distillTarget: 'lore',
    qualityCriteria: ['包含人物的生卒年和主要事迹', '有历史评价或影响分析', META_EXCLUSION_ZH],
    minArticles: 2,
  },
  {
    name: 'atmosphere',
    display: '氛围',
    description: '氛围：叙事基调、情感色彩、感官特征',
    priority: 'supplementary',
    source: 'planned',
    signals: ['atmosphere', 'mood', 'tone', 'aesthetic', 'vibe', 'feeling', 'ambiance', 'dark', 'grim', '氛围', '基调', '情绪', '美学', '风格', '感觉', '格调', '气氛'],
    queries: ['{name} aesthetic mood', '{name} tone atmosphere', '{name} art style', '{localName} 氛围 风格', '{localName} 美学 基调'],
    distillTarget: 'atmosphere',
    qualityCriteria: ['有文学或美学分析', '描述情感氛围而非事实', META_EXCLUSION_ZH],
    minArticles: 2,
  },
]

// ========== Localized display/description/qualityCriteria ==========

interface LocalizedWorldDimensionStrings {
  display: Record<SupportedLanguage, string>
  description: Record<SupportedLanguage, string>
  qualityCriteria: Record<SupportedLanguage, string[]>
}

const WORLD_DIMENSION_L10N: Record<string, LocalizedWorldDimensionStrings> = {
  geography: {
    display: { zh: '地理', en: 'Geography', ja: '地理' },
    description: {
      zh: '空间：地点、地标、区域划分、空间结构',
      en: 'Space: locations, landmarks, regional divisions, spatial structure',
      ja: '空間：場所・ランドマーク・地域区分・空間構造',
    },
    qualityCriteria: {
      zh: ['包含具体地点名称和位置描述', '有战略或历史意义的分析', META_EXCLUSION_CRITERION.zh],
      en: ['Contains specific place names and location descriptions', 'Has strategic or historical significance analysis', META_EXCLUSION_CRITERION.en],
      ja: ['具体的な地名と位置の記述を含む', '戦略的または歴史的意義の分析がある', META_EXCLUSION_CRITERION.ja],
    },
  },
  history: {
    display: { zh: '历史', en: 'History', ja: '歴史' },
    description: {
      zh: '时间：编年、关键事件、起源、纪元划分',
      en: 'Time: chronicles, key events, origins, era divisions',
      ja: '時間：年代記・重要事件・起源・紀元区分',
    },
    qualityCriteria: {
      zh: ['包含具体时间和事件', '有因果关系分析', META_EXCLUSION_CRITERION.zh],
      en: ['Contains specific dates and events', 'Has causal relationship analysis', META_EXCLUSION_CRITERION.en],
      ja: ['具体的な時期と出来事を含む', '因果関係の分析がある', META_EXCLUSION_CRITERION.ja],
    },
  },
  factions: {
    display: { zh: '势力', en: 'Factions', ja: '勢力' },
    description: {
      zh: '势力：组织、阵营、政治结构、权力关系',
      en: 'Factions: organizations, alignments, political structure, power relations',
      ja: '勢力：組織・陣営・政治構造・権力関係',
    },
    qualityCriteria: {
      zh: ['描述组织结构和权力关系', '有政策或治理方式的说明', META_EXCLUSION_CRITERION.zh],
      en: ['Describes organizational structure and power relations', 'Includes policy or governance explanations', META_EXCLUSION_CRITERION.en],
      ja: ['組織構造と権力関係を記述している', '政策や統治方式の説明がある', META_EXCLUSION_CRITERION.ja],
    },
  },
  systems: {
    display: { zh: '体系', en: 'Systems', ja: '体系' },
    description: {
      zh: '体系：科技/魔法、法律、治理、经济基础设施',
      en: 'Systems: technology/magic, law, governance, economic infrastructure',
      ja: '体系：科学技術/魔法・法律・統治・経済インフラ',
    },
    qualityCriteria: {
      zh: ['解释制度或体系的运作机制', '有历史渊源说明', META_EXCLUSION_CRITERION.zh],
      en: ['Explains how the system or institution operates', 'Includes historical context', META_EXCLUSION_CRITERION.en],
      ja: ['制度や体系の運作メカニズムを説明している', '歴史的淵源の説明がある', META_EXCLUSION_CRITERION.ja],
    },
  },
  society: {
    display: { zh: '社会', en: 'Society', ja: '社会' },
    description: {
      zh: '社会：日常生活、阶层、生存方式、经济运转',
      en: 'Society: daily life, social classes, survival, economic operation',
      ja: '社会：日常生活・階層・生存方式・経済運営',
    },
    qualityCriteria: {
      zh: ['描述社会阶层或日常生活', '有具体的经济或民生数据', META_EXCLUSION_CRITERION.zh],
      en: ['Describes social classes or daily life', 'Includes specific economic or livelihood data', META_EXCLUSION_CRITERION.en],
      ja: ['社会階層や日常生活を描写している', '具体的な経済・民生データがある', META_EXCLUSION_CRITERION.ja],
    },
  },
  culture: {
    display: { zh: '文化', en: 'Culture', ja: '文化' },
    description: {
      zh: '文化：习俗、信仰、语言、艺术、价值观',
      en: 'Culture: customs, beliefs, language, art, values',
      ja: '文化：慣習・信仰・言語・芸術・価値観',
    },
    qualityCriteria: {
      zh: ['描述文化特征或艺术成就', '有具体作品或人物举例', META_EXCLUSION_CRITERION.zh],
      en: ['Describes cultural characteristics or artistic achievements', 'Includes specific works or figure examples', META_EXCLUSION_CRITERION.en],
      ja: ['文化的特徴や芸術的成果を記述している', '具体的な作品や人物の例がある', META_EXCLUSION_CRITERION.ja],
    },
  },
  species: {
    display: { zh: '族群', en: 'Species', ja: '種族' },
    description: {
      zh: '族群：种族、居民类型、存在类别、群体特征',
      en: 'Species: races, inhabitant types, existence categories, group traits',
      ja: '種族：人種・住民の種類・存在のカテゴリ・集団的特徴',
    },
    qualityCriteria: {
      zh: ['描述族群特征或分布', '有人口或民族关系信息', META_EXCLUSION_CRITERION.zh],
      en: ['Describes species characteristics or distribution', 'Includes population or ethnic relations information', META_EXCLUSION_CRITERION.en],
      ja: ['種族の特徴や分布を記述している', '人口や民族関係の情報がある', META_EXCLUSION_CRITERION.ja],
    },
  },
  figures: {
    display: { zh: '人物', en: 'Figures', ja: '人物' },
    description: {
      zh: '人物：关键角色、标志性人物、世界的定义者',
      en: 'Figures: key characters, iconic figures, world-defining individuals',
      ja: '人物：キーキャラクター・象徴的人物・世界を定義する者',
    },
    qualityCriteria: {
      zh: ['包含人物的生卒年和主要事迹', '有历史评价或影响分析', META_EXCLUSION_CRITERION.zh],
      en: ['Contains birth/death dates and major deeds', 'Has historical evaluation or impact analysis', META_EXCLUSION_CRITERION.en],
      ja: ['人物の生没年と主要な功績を含む', '歴史的評価や影響分析がある', META_EXCLUSION_CRITERION.ja],
    },
  },
  atmosphere: {
    display: { zh: '氛围', en: 'Atmosphere', ja: '雰囲気' },
    description: {
      zh: '氛围：叙事基调、情感色彩、感官特征',
      en: 'Atmosphere: narrative tone, emotional color, sensory characteristics',
      ja: '雰囲気：叙事のトーン・感情的色彩・感覚的特徴',
    },
    qualityCriteria: {
      zh: ['有文学或美学分析', '描述情感氛围而非事实', META_EXCLUSION_CRITERION.zh],
      en: ['Has literary or aesthetic analysis', 'Describes emotional atmosphere rather than facts', META_EXCLUSION_CRITERION.en],
      ja: ['文学的または美学的分析がある', '事実ではなく感情的雰囲気を描写している', META_EXCLUSION_CRITERION.ja],
    },
  },
}

/**
 * Get world dimension templates localized to the specified language.
 * Falls back to current locale if no language specified.
 */
export function getLocalizedWorldDimensions(lang?: SupportedLanguage): DimensionDef[] {
  const language = lang ?? getLocale()
  return WORLD_DIMENSION_TEMPLATES.map((dim) => {
    const l10n = WORLD_DIMENSION_L10N[dim.name]
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
export const WORLD_BASE_DIMENSIONS = WORLD_DIMENSION_TEMPLATES

// ========== Legacy exports (backward compat) ==========

export const ALL_WORLD_DIMENSIONS: WorldDimension[] = WORLD_DIMENSION_TEMPLATES.map((d) => d.name as WorldDimension)
export const REQUIRED_WORLD_DIMENSIONS: WorldDimension[] = WORLD_DIMENSION_TEMPLATES.filter((d) => d.priority === 'required').map((d) => d.name as WorldDimension)

export interface WorldDimensionDef {
  priority: WorldDimensionPriority
  description: string
  distillTarget: EntryScope
}

export const WORLD_DIMENSIONS: Record<WorldDimension, WorldDimensionDef> = Object.fromEntries(
  WORLD_DIMENSION_TEMPLATES.map((d) => [d.name, { priority: d.priority, description: d.description, distillTarget: d.distillTarget as EntryScope }]),
) as any

export const WORLD_DIMENSION_SIGNALS: Record<WorldDimension, RegExp[]> = Object.fromEntries(
  WORLD_DIMENSION_TEMPLATES.map((d) => [d.name, signalsToRegex(d.signals)]),
) as any

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

  const effectiveLocalName = localName && localName !== englishName ? localName : englishName

  const dimensions: WorldDimensionPlan[] = WORLD_DIMENSION_TEMPLATES.map((dimDef) => ({
    dimension: dimDef.name as WorldDimension,
    priority: dimDef.priority as WorldDimensionPriority,
    queries: dimDef.queries.map((t) =>
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
