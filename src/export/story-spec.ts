export interface CharacterAxis {
  /** Display name (e.g., "信任") */
  name: string
  /** kebab-case English identifier for state tracking (e.g., "trust") */
  english: string
  /** Initial value 0-10 */
  initial: number
}

export type CharacterRole = 'protagonist' | 'deuteragonist' | 'antagonist' | 'supporting'

export interface CharacterSpec {
  /** Soul name (matches souls/{name}/ directory) */
  name: string
  /** Display name from soul manifest */
  display_name?: string
  role: CharacterRole
  /** 2-3 affinity axes specific to this character */
  axes: CharacterAxis[]
  /** When the character first appears (e.g., "act_1", "act_2"). Defaults to "act_1". */
  appears_from?: string
  /** Optional one-line summary of this character's relationship dynamics */
  dynamics_note?: string
}

/**
 * A length preset offered to the user at skill startup (Phase 0).
 * Agent provides 2-3 ActOptions and the user picks one to determine
 * total acts, expected rounds, and ending count for this playthrough.
 */
export interface ActOption {
  /** Total acts for this length (e.g., 3, 5, 7) */
  acts: number
  /** Display label in Chinese (e.g., "短篇" / "中篇" / "长篇") */
  label_zh: string
  /** Expected total rounds range (e.g., "24-36") */
  rounds_total: string
  /** Number of distinct endings for this length */
  endings_count: number
}

export interface StorySpecConfig {
  /** Story name provided by the user (identity of this export) */
  story_name: string
  /** Optional free-form user direction text (injected at top of agent prompt) */
  user_direction?: string
  genre: string
  tone: string
  constraints: string[]
  /** 2-3 length presets the user can choose from at runtime */
  acts_options: ActOption[]
  /** Default length: must equal one of acts_options[i].acts */
  default_acts: number
  /** Multi-character cast. Empty or single = backward-compatible single-character mode. */
  characters?: CharacterSpec[]
}

function formatCharactersBlock(characters: CharacterSpec[]): string {
  return characters.map((c) => {
    const axesYaml = c.axes.map((a) =>
      `      - { name: "${a.name}", english: ${a.english}, initial: ${a.initial} }`
    ).join('\n')
    const appearsFrom = c.appears_from ? `    appears_from: ${c.appears_from}` : ''
    const dynamicsNote = c.dynamics_note ? `    dynamics_note: "${c.dynamics_note}"` : ''
    const lines = [
      `  - name: "${c.name}"`,
      c.display_name ? `    display_name: "${c.display_name}"` : '',
      `    role: ${c.role}`,
      '    axes:',
      axesYaml,
      appearsFrom,
      dynamicsNote,
    ].filter(Boolean)
    return lines.join('\n')
  }).join('\n')
}

function buildMultiCharacterRules(characters: CharacterSpec[]): string {
  const charNames = characters.map((c) => c.name).join('、')
  const protagonist = characters.find((c) => c.role === 'protagonist')?.name ?? characters[0]?.name ?? ''

  return `
## 多角色编排（Cast）

本剧本包含 ${characters.length} 个核心角色：${charNames}。

### 角色定位

${characters.map((c) => {
  const roleLabel = c.role === 'protagonist' ? '主角'
    : c.role === 'deuteragonist' ? '次主角/对位角色'
    : c.role === 'antagonist' ? '对立角色'
    : '配角'
  const axes = c.axes.map((a) => `${a.name}(${a.english})`).join(' / ')
  const appearsLine = c.appears_from && c.appears_from !== 'act_1' ? `从 ${c.appears_from} 开始登场` : '全程出场'
  const dynamicsLine = c.dynamics_note ? `\n  - 动态: ${c.dynamics_note}` : ''
  return `- **${c.name}** [${roleLabel}]
  - 好感轴: ${axes}
  - 出场: ${appearsLine}${dynamicsLine}`
}).join('\n')}

### Cast 调度规则

每个场景必须显式标注 cast（在场角色），不在场角色不参与该场景对话，其好感轴不受该场景选项影响。

\`\`\`
[scene: 场景ID]

[narration]
旁白...

[cast]
- ${protagonist}: { mood: ..., stance: ... }
- {其他在场角色}: { mood: ..., stance: ... }

[dialogue]
${protagonist}: "..."
{其他角色}: "..."
（旁白可穿插）

[choices]
- "选项文字" -> scene:{下一场景} | ${protagonist}.${characters[0]?.axes[0]?.english ?? 'trust'} +2, {其他角色}.{轴} +/- N
- ...
\`\`\`

### 选项 Tradeoff 约束（重要）

- 每个选项必须对**不同角色产生差异化好感影响**（一个上升另一个下降，或不同强度）
- **禁止**所有选项对所有角色产生相同方向的影响（这是无意义选项）
- 至少有一个选项要让 protagonist 和 deuteragonist 之间产生张力
- 配角好感影响幅度通常小于主要角色

### 角色出场时机

${characters.filter((c) => c.appears_from && c.appears_from !== 'act_1').length > 0
  ? characters.filter((c) => c.appears_from && c.appears_from !== 'act_1')
      .map((c) => `- ${c.name}: 从 ${c.appears_from} 开始登场，首次出场必须有自然引入`)
      .join('\n')
  : '所有角色全程出场。'}
`
}

function buildMultiCharacterStateSystem(characters: CharacterSpec[]): string {
  return `
## 状态系统（多角色）

### per-character 好感轴

每个角色有独立的好感轴，初始值如下：

${characters.map((c) => {
  const axesList = c.axes.map((a) => `${a.english}: ${a.initial}`).join(', ')
  return `- **${c.name}**: { ${axesList} }`
}).join('\n')}

### 关键事件标记（3-6 个）

布尔值标记。命名格式建议：\`{动作}_{角色?}\`，如 \`shared_secret_zhuge\`、\`alliance_proposed_sima\`。

### 状态对象示例

\`\`\`
{
  affinity: {
${characters.map((c) => {
  const axes = c.axes.map((a) => `      ${a.english}: ${a.initial}`).join(',\n')
  return `    "${c.name}": {\n${axes}\n    }`
}).join(',\n')}
  },
  flags: {
    // 由剧本生成时定义
  }
}
\`\`\`

### 选项状态影响格式

每个选项必须明确标注对哪些角色的哪些轴造成什么影响：

\`\`\`
- "选项文字" -> scene:next | ${characters[0]?.name ?? '角色A'}.${characters[0]?.axes[0]?.english ?? 'trust'} +2, ${characters[1]?.name ?? '角色B'}.${characters[1]?.axes[0]?.english ?? 'respect'} -1, flag:shared_secret = true
\`\`\`
`
}

function buildMultiCharacterEnding(characters: CharacterSpec[], minEndings: number): string {
  const exampleA = characters[0] && characters[0].axes[0]
    ? `${characters[0].name}.${characters[0].axes[0].english} >= 7 AND flag:shared_secret = true`
    : 'condition'
  const exampleB = characters[1] && characters[1].axes[0]
    ? `${characters[1].name}.${characters[1].axes[0].english} >= 8`
    : 'condition'

  return `
## 结局判定（多角色组合）

至少 ${minEndings} 个不同结局（取决于运行时所选幕数），由多角色好感轴的组合 + 关键事件标记决定。

每个结局必须定义触发条件，由数值阈值和事件标记组合构成。
条件按优先级从高到低排列，第一个满足的触发。
**最后一个结局必须是无条件默认结局**（兜底）。

格式示例：
\`\`\`
Ending A: {标题}
  条件: ${exampleA}

Ending B: {标题}
  条件: ${exampleB}

Ending C: {标题}
  条件: (默认)
\`\`\`

### 结局设计指引

- 不同结局应该反映**不同角色组合**的最终状态
- 至少要有：
  - 1 个偏向 protagonist 的结局
  - 1 个偏向 deuteragonist 的结局
  - 1 个所有角色都达到高好感的"完美"结局
  - 1 个默认/失败结局
- 结局之间必须有明显的情感差异

## 结局图鉴展示

到达结局时按以下顺序展示：

### 1. 结局演绎
结局旁白 + 在场角色的完整演绎（与普通场景格式一致）。

### 2. 旅程回顾

按角色分组展示每个角色的好感轴最终值：

\`\`\`
${characters.map((c) => {
  const axesLines = c.axes.map((a) => `  ${a.name.padEnd(8)} {bar} {value}/10`).join('\n')
  return `${c.name}:\n${axesLines}`
}).join('\n')}
\`\`\`

进度条格式：\`'█'.repeat(value) + '░'.repeat(10-value)\`

### 3. 关键事件标记

\`\`\`
{事件名} ✓  (已触发)
{事件名} ✗  (未触发)
\`\`\`

### 4. 结局图鉴（所有结局）

列出**所有**结局，每个包含：
- 标题（达成的标 ★，未达成标 ☆）
- 触发条件概述（如"需要诸葛亮信任 ≥ 7 且分享了秘密"）
- 一句预览文字（该结局开头第一句话）

格式示例：
\`\`\`
★ 星落五丈原 (已达成)
  "你守到了最后..."

☆ 卧龙凤雏 (未达成)
  条件: 诸葛亮.bond ≥ 8 AND 黄月英.warmth ≥ 8
  "如果你更早认识她..."
\`\`\`

### 5. 重玩选项

使用 AskUserQuestion 提供：
- "从头再来" — **复用当前剧本**，重置 affinity 和 flags 到剧本声明的 \`initial_state\`，清空当前 slot 的 state.yaml，从 Phase 2 第一场景重新开始；不重新进入 Phase 0/1，不重新生成剧本
- "结束故事" — 故事完结

如需玩全新剧本，请结束故事后重启 skill，在 Phase -1 菜单选择「生成新剧本」。
`
}

function buildSingleCharacterStateSystem(): string {
  return `
## 状态系统

### 数值轴（2-3 个）
根据角色人格和世界观设计，每个轴范围 0-10，初始值 5。
轴名称必须反映角色的核心人格特征（如 trust、understanding、bond），不要使用通用名称。

### 关键事件标记（3-5 个）
布尔值，标记玩家是否触发了关键剧情节点。
事件名称必须对应剧情中的具体转折点（如 shared_secret、confronted_past）。

### 选项状态影响
每个场景的 [choices] 必须标注该选择对状态的影响（数值变化和/或事件触发）。
不同选项应该对状态产生不同方向的影响，避免所有选项都加同一个轴。
`
}

function buildSingleCharacterEnding(): string {
  return `
## 结局判定

每个结局必须定义触发条件，由数值阈值和事件标记组合构成。
条件按优先级从高到低排列，第一个满足的触发。
**最后一个结局必须是无条件默认结局**（兜底）。

格式：
\`\`\`
Ending A: {标题}
  条件: trust >= 7 AND shared_secret = true

Ending B: {标题}
  条件: understanding >= 7

Ending C: {标题}
  条件: (默认)
\`\`\`

## 结局展示

每个结局必须包含：
1. 结局旁白和角色演绎（与普通场景格式一致）
2. 旅程回顾数据：列出最终的数值轴值和触发的事件标记
3. 所有其他结局的预览：标题 + 触发条件概述 + 一句预览文字

## 重玩选项

使用 AskUserQuestion 提供：
- "从头再来" — **复用当前剧本**，重置 axes 和 flags 到剧本声明的 \`initial_state\`，清空当前 slot 的 state.yaml，从 Phase 2 第一场景重新开始；不重新进入 Phase 0/1，不重新生成剧本
- "结束故事" — 故事完结

如需玩全新剧本，请结束故事后重启 skill，在 Phase -1 菜单选择「生成新剧本」。
`
}

function formatActOptionsBlock(options: ActOption[]): string {
  return options.map((o) =>
    `  - { acts: ${o.acts}, label_zh: "${o.label_zh}", rounds_total: "${o.rounds_total}", endings_count: ${o.endings_count} }`
  ).join('\n')
}

function formatActOptionsSummary(options: ActOption[], defaultActs: number): string {
  return options.map((o) => {
    const marker = o.acts === defaultActs ? ' [推荐]' : ''
    return `- **${o.label_zh}** (${o.acts} 幕，${o.rounds_total} 轮，${o.endings_count} 结局)${marker}`
  }).join('\n')
}

function escapeYamlString(s: string): string {
  // Wrap in double quotes and escape embedded double-quotes/backslashes
  return `"${s.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`
}

function formatUserDirectionBlock(direction: string): string {
  // YAML literal block scalar (|) preserves newlines without escaping
  const indented = direction.split('\n').map((line) => `  ${line}`).join('\n')
  return `user_direction: |\n${indented}\n`
}

export function generateStorySpec(config: StorySpecConfig): string {
  const { story_name, user_direction, genre, tone, constraints, acts_options, default_acts, characters } = config

  const isMultiCharacter = !!characters && characters.length > 1

  // Use the smallest endings_count from acts_options as the multi-char min baseline
  const minEndings = acts_options.length > 0
    ? Math.min(...acts_options.map((o) => o.endings_count))
    : 4

  const constraintsBlock = constraints.length > 0
    ? `\n## 额外约束\n\n${constraints.map((c) => `- ${c}`).join('\n')}\n`
    : ''

  const charactersFrontmatter = characters && characters.length > 0
    ? `\ncharacters:\n${formatCharactersBlock(characters)}\n`
    : ''

  const actOptionsFrontmatter = `\nacts_options:\n${formatActOptionsBlock(acts_options)}\ndefault_acts: ${default_acts}\n`

  const userDirectionFrontmatter = user_direction && user_direction.trim().length > 0
    ? formatUserDirectionBlock(user_direction.trim())
    : ''

  const storyIdentityBlock = `\n# 故事身份

- **故事名**: ${story_name}${user_direction && user_direction.trim().length > 0 ? `\n- **用户原始意图**:\n\n> ${user_direction.trim().split('\n').join('\n> ')}\n` : ''}
`

  const castSection = isMultiCharacter ? buildMultiCharacterRules(characters!) : ''
  const stateSection = isMultiCharacter
    ? buildMultiCharacterStateSystem(characters!)
    : buildSingleCharacterStateSystem()
  const endingSection = isMultiCharacter
    ? buildMultiCharacterEnding(characters!, minEndings)
    : buildSingleCharacterEnding()

  const maxActs = Math.max(...acts_options.map((o) => o.acts), default_acts)

  return `---
story_name: ${escapeYamlString(story_name)}
${userDirectionFrontmatter}genre: ${genre}
tone: ${tone}${actOptionsFrontmatter}${charactersFrontmatter}---
${storyIdentityBlock}
# Seeds

此处由 Skill 运行时 Phase 0 收集的用户 seeds 动态填充。
如果用户选择"让命运来决定"，则此段为空，完全随机生成。

# 故事长度（运行时选择）

故事长度由用户在 Phase 0 选择，可选项：

${formatActOptionsSummary(acts_options, default_acts)}

引擎在用户选择后，将所选项的 acts 写入 \`state.chosen_acts\`，rounds_total 写入 \`state.rounds_budget\`，endings_count 写入 \`state.target_endings_count\`。后续所有结构性指标都以这些 runtime 值为准。

## appears_from 截断规则

如果某角色的 \`appears_from\` 大于用户所选 \`chosen_acts\`：
- 截断到最后一幕（act_{chosen_acts}）首次出场
- 不报错，自然引入

# 剧本生成规约

## 结构要求

- 幕数: 用户在 Phase 0 选择的 \`state.chosen_acts\`，每幕 2-4 个场景
- 结局数: 至少 \`state.target_endings_count\` 个
- 总交互轮数: \`state.rounds_budget\`
- 每个场景结尾必须有 2-3 个选项

## 场景格式

每个场景必须包含：

\`\`\`
[narration]
第二人称沉浸式旁白，描述环境、氛围、角色状态。

[character: {角色名}]
state: 角色当前的情绪/身体状态
attitude: 对用户的态度
key_info: 本场景必须透露的关键信息
tone: 对话的情绪基调

[choices]
- "选项文字" -> scene:{下一场景ID} | {状态影响}
- "选项文字" -> scene:{下一场景ID} | {状态影响}
\`\`\`

状态影响格式示例：\`trust +1, understanding +2\` 或 \`shared_secret = true\`

## 叙事约束

- 类型为「${genre}」，整体风格为「${tone}」
- 开场必须自然引入角色与用户的相遇
- 选项必须产生实质性的剧情分歧，不能殊途同归
- 结局之间要有明显的情感差异
- 世界观元素要自然融入场景，不要说教式展示

## 角色约束

- 角色行为必须符合 souls/{角色名}/identity.md 中的人格描述
- 说话方式必须符合 souls/{角色名}/style.md
- 角色不会无条件信任用户，信任需要通过选择建立
${castSection}${stateSection}${endingSection}
## 幕间过渡

- 每次 Act 切换必须有过渡旁白（总结上一幕情绪余韵）
- 过渡后附带一个反思性选择（不影响剧情走向，影响下一幕情绪入口）

## 禁止

- 不要生成超过 \`state.chosen_acts × 5\` 个场景（运行时上限）
- 不要生成单选项场景（死路）
- 不要在前 \`floor(state.chosen_acts / 2)\` 幕就出现结局分支
- 不要让角色主动打破第四面墙
- 静态参考: 最长剧本不超过 ${maxActs * 5} 个场景
${constraintsBlock}`
}
