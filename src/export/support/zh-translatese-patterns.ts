/**
 * 中文翻译腔反例库 —— 通用 (IP-agnostic).
 *
 * 这份库的目的：给 export agent 和下游 Phase 1/2 LLM 一份具体可对照的
 * "翻译腔症状学"。任何中文创作环节都必须避开这些结构性反模式。
 *
 * 反模式的本质不是"用词错误"，而是 **整段叙事是用英文/日文思维写出来
 * 再字面转译的**：句法结构、比喻选词、所有格排比、度量状语都是源语言
 * 的字面投影。LLM 默认中文带强烈的这类倾向，不给具体反例它会一犯再犯。
 *
 * 扩展规则：
 * - 新增条目时 id 必须是 snake_case 且唯一
 * - bad / good 必须是真实可对比的中文段落（不是抽象描述）
 * - reason 要说出"为什么 bad 是翻译腔"，而不是泛泛说"不地道"
 * - 按出现频率从高到低排列（前 5 条是 fallback 场景会使用的最高频条目）
 */

export interface ProseStyleForbiddenPattern {
  /** snake_case 唯一标识，例如 'degree_clause' */
  id: string
  /** 反例：一段带翻译腔的中文 */
  bad: string
  /** 正例：同样内容的地道中文 */
  good: string
  /** 为什么 bad 是翻译腔；指出源语言结构如何字面投影到中文 */
  reason: string
}

/**
 * 通用中文翻译腔反例库。
 *
 * 当前 10 条覆盖最常见的结构性反模式。前 5 条（degree_clause /
 * gaze_level / possessive_chain / literal_metaphor / small_body）
 * 作为 fallback 时的最小子集嵌入 SKILL.md 模板。
 */
export const ZH_TRANSLATESE_PATTERNS: ProseStyleForbiddenPattern[] = [
  {
    id: 'degree_clause',
    bad: '她抓着你腰的手，一瞬间收紧到了指甲嵌进你衣服的程度。',
    good: '她抓着你腰的手猛地收紧。指甲都掐进了你的衣服里。',
    reason:
      '英文式"...to the degree that..."从句的字面翻译。中文不用"收紧到 X 的程度"这种度量状语包装；直接把程度用动词+短句断出来。',
  },
  {
    id: 'gaze_level',
    bad: '她蹲下来，让自己的视线和那个九岁女孩的视线持平。',
    good: '她蹲下来，与那个九岁女孩平视。',
    reason:
      '英文"level her gaze with"的字面翻译。中文没有"让视线和视线持平"这种说法；"平视"一个词足够，把"视线"当名词操作是英文习惯。',
  },
  {
    id: 'possessive_chain',
    bad: '我的 Berserker。我的赫拉克勒斯。我的……唯一的，朋友。',
    good: 'Berserker。赫拉克勒斯。……我唯一的朋友。',
    reason:
      '英文"my X. my Y. my Z."所有格排比的字面翻译。中文表达同一情感通常不需要每句都带"我的"，第一人称的归属感由上下文承担即可。',
  },
  {
    id: 'literal_metaphor',
    bad: '她小小的身体在月光下变得更小了——像一个被拔了灯芯的瓷灯。',
    good: '她的身影在月光下显得更瘦小——像一盏被拔了灯芯的油灯。',
    reason:
      '直译英文比喻时挑错中文具象名词。"瓷灯"不是中文常见意象；"油灯"才是被拔灯芯的那种灯。翻译腔经常在比喻喻体上挑错中文对应物。',
  },
  {
    id: 'small_body',
    bad: '她小小的身体向后退了一步。',
    good: '她小小的身影向后退了一步。',
    reason:
      '英文"her small body"的字面翻译。中文描写儿童或娇小角色时很少直接用"身体"，更自然的是"身影""身子""身姿"。"身体"在中文里偏向生理学或医学语境。',
  },
  {
    id: 'held_back_negative',
    bad: '她伸出手，停在伊莉雅的银发上方——没有摸下去。',
    good: '她伸出手，悬在伊莉雅的银发上方，终究没有落下。',
    reason:
      '英文"held back from touching"的字面翻译。"没有摸下去"这种"先提动作再否定"的结构在中文里很生硬；中文倾向用"终究没有""悬而未落"这种描述静止姿态的词组。',
  },
  {
    id: 'night_of_event',
    bad: '我，阿尔托莉雅·潘德拉贡，曾在你失去他的那一夜，跪在你面前。',
    good: '我，阿尔托莉雅·潘德拉贡，今夜，在你失去他的此刻，跪在你身旁。',
    reason:
      '英文"the night you lost him"的字面翻译。"你失去他的那一夜"这种后置定语过长，中文更习惯用时间副词短句断开叙述节奏。',
  },
  {
    id: 'abstract_noun',
    bad: '她说"朋友"两个字的时候，声音里没有任何起伏。',
    good: '她说"朋友"两个字的时候，声音平得像一面湖。',
    reason:
      '英文"without any inflection"的字面翻译。中文不喜欢"里没有任何 X"这种抽象名词的否定式；用具象的比喻（"平得像一面湖"）远比"没有起伏"有画面感。',
  },
  {
    id: 'etch_into',
    bad: '我会把这一刻刻进我的剑里。',
    good: '我要把今夜镌刻进这柄剑的剑魂。',
    reason:
      '英文"etch this moment into my sword"的字面翻译。中文里"把时刻刻进物体里"的动宾搭配很别扭；"镌刻"+"剑魂"这种更古风的搭配才符合中文叙事逻辑。另外"我会"过弱，"我要"更有决意。',
  },
  {
    id: 'belongs_to_you',
    bad: '这是属于你的孤独，没有人能代替。',
    good: '这份孤独是你的。没有人能替。',
    reason:
      '英文"this loneliness belongs to you"的字面翻译。"属于你的 X"是英文所有格从句的直译，中文更自然的是把主语后置或用"是你的"。而且"没有人能代替"在中文里"代替什么"缺省了宾语，不如"没有人能替"干净。',
  },
]
