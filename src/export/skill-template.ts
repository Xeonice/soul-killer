import type { CharacterSpec, ActOption } from './story-spec.js'

export interface SkillTemplateConfig {
  skillName: string
  /** Story name provided by the user — used for the intro and references */
  storyName: string
  worldDisplayName: string
  description: string
  /** Multi-character cast. Empty or single = backward-compatible single-character mode. */
  characters?: CharacterSpec[]
  /** Runtime-selectable length presets */
  acts_options: ActOption[]
  /** Default acts (must be one of acts_options[i].acts) */
  default_acts: number
}

function buildMultiCharacterEngine(characters: CharacterSpec[]): string {
  const charNames = characters.map((c) => c.name).join('、')
  const protagonist = characters.find((c) => c.role === 'protagonist')?.name ?? characters[0]!.name
  const soulsList = characters.map((c) => `   - \`\${CLAUDE_SKILL_DIR}/souls/${c.name}/identity.md\`\n   - \`\${CLAUDE_SKILL_DIR}/souls/${c.name}/style.md\`\n   - \`\${CLAUDE_SKILL_DIR}/souls/${c.name}/capabilities.md\`（如存在）\n   - \`\${CLAUDE_SKILL_DIR}/souls/${c.name}/milestones.md\`（如存在）\n   - \`\${CLAUDE_SKILL_DIR}/souls/${c.name}/behaviors/\` 下所有文件`).join('\n')

  const initialState = characters.map((c) => {
    const axes = c.axes.map((a) => `      ${a.english}: ${a.initial}`).join(',\n')
    return `    "${c.name}": {\n${axes}\n    }`
  }).join(',\n')

  return `# Phase 1: 生成多角色剧本并持久化

本剧本包含 ${characters.length} 个核心角色：${charNames}。

依次读取以下文件：

1. 每个角色的人格资料：
${soulsList}
2. 读取 \`\${CLAUDE_SKILL_DIR}/world/\` 下各维度子目录（geography、factions、systems、society、culture、species、figures、atmosphere、history）中的所有 .md 文件 — 世界观。跳过 \`_\` 前缀文件（作者视图），并排除 \`history/events/\` 子目录和 \`history/timeline.md\` 单文件（它们在下面单独读取）
3. 读取 \`\${CLAUDE_SKILL_DIR}/world/history/timeline.md\`（如存在）— 世界编年史单文件（按 \`## \` 段落切分，每段是一个时间锚点事件）
4. 读取 \`\${CLAUDE_SKILL_DIR}/world/history/events/\` 下所有文件（如存在）— 世界编年史详情（重大事件的完整描述）
5. 读取 \`\${CLAUDE_SKILL_DIR}/story-spec.md\` — 剧本规约（含 characters 编排）

根据以上材料和用户在 Phase 0 收集的 seeds（如有），按照 story-spec.md 的规约，创作一个完整的多角色视觉小说剧本。

**编年史一致性要求**：
- 剧本中引用的所有时间锚点（年份、纪元、战役编号等）必须与 \`history/timeline.md\` 段落中的 \`display_time\` 一致
- 不得编造与 \`history/events/\` 详情冲突的事件经过
- 如剧本发生在某个特定时期，应明确标注与 chronicle 时间轴的相对位置（例如"在荒坂塔核爆五年之后"）

剧本必须遵守 story-spec.md 中的：
- 多角色 cast 调度规则（每个场景显式标注在场角色）
- 选项 tradeoff 约束（每个选项必须对不同角色产生差异化影响）
- 角色出场时机（${characters.filter((c) => c.appears_from && c.appears_from !== 'act_1').map((c) => `${c.name} 从 ${c.appears_from} 开始`).join('，') || '所有角色全程出场'}）

## 剧本持久化（必须执行）

剧本生成完成后，**必须**通过 Write 工具将完整剧本以 YAML 格式写入：

\`\`\`
\${CLAUDE_SKILL_DIR}/runtime/scripts/script-<id>.yaml
\`\`\`

\`<id>\` 是 8 位短 hash，由你基于当前时间戳和 user_direction 摘要生成（例如 \`a3f9c2e1\`）。

文件内容必须以 YAML frontmatter 开头，再接剧本正文：

\`\`\`yaml
---
id: <8 位短 hash，与文件名一致>
title: <你为本剧本起的简短标题，能让玩家在菜单里识别>
generated_at: <ISO 8601 时间戳>
user_direction: <Phase 0 收集的命题文本，无则空字符串>
acts: <state.chosen_acts>
---

initial_state:
  affinity:
${characters.map((c) => `    "${c.name}":\n${c.axes.map((a) => `      ${a.english}: ${a.initial}`).join('\n')}`).join('\n')}
  flags:
    # 你定义的全部 flag，初始值均为 false

scenes:
  - id: scene-001
    cast: [<在场角色名>]
    narration: |
      <旁白>
    dialogue: |
      <角色对话>
    choices:
      - text: "<选项 A>"
        consequences:
          # 例：affinity.<角色>.<轴> 增减、flags.<flag名> 设为 true
        next: scene-002
      - text: "<选项 B>"
        consequences: { ... }
        next: scene-003
  # ... 后续所有场景

endings:
  - id: ending-A
    title: "<结局标题>"
    condition: "<触发条件，如 affinity.<角色>.<轴> >= 7 AND flags.<flag>>"
    body: |
      <结局演绎>
  # ... 其他结局
\`\`\`

**Write 调用要求**：
- 一次性写入完整文件，不要分段追加
- 写入完成后向用户输出一句确认："剧本已保存为 \`script-<id>.yaml\`"
- 写入后剧本仍保留在你的上下文中，Phase 2 直接使用

**写入失败容错**：
- 如果 Write 工具调用失败（权限不足、磁盘问题等），输出错误信息
- 仍然进入 Phase 2 运行剧本（剧本在上下文中可用）
- 提示用户："本次剧本未能持久化，重试时将不可复现"

写入成功（或失败兜底完成）后，进入 Phase 2。

# Phase 2: 运行多角色故事

剧本准备好后，直接进入第一个场景。

## 场景呈现规则

每个场景你需要输出：
1. **旁白** — 使用沉浸式第二人称描写
2. **多角色演绎** — 按场景 cast 表中定义的在场角色，依次或交替展现各角色的对话和行动
   - 每个角色的语言风格必须遵循对应 \`souls/{角色名}/style.md\`
   - 不同角色的对话之间可以穿插旁白
   - 不在场角色不参与本场景对话

然后使用 AskUserQuestion 呈现选项：
- question: 当前场景的情境提示
- options: 对应剧本中该场景的选项
- multiSelect: false

## 状态追踪规则（多角色）

你必须在内部维护一个状态对象，格式如下：
\`\`\`
{
  affinity: {
${initialState}
  },
  flags: {
    // 由 Phase 1 生成的剧本定义
  }
}
\`\`\`

### 选择影响规则

- 用户做出选择后，根据剧本中该选项标注的状态影响更新状态对象
- 一个选项可以同时影响**多个角色**的好感轴
- 不同选项必须对不同角色产生**差异化**影响（这是 story-spec 的硬约束）
- **绝对不要**向用户展示状态数值或事件标记——状态是隐式的
- 状态影响后续场景中各角色的态度、对话语气和反应

### 角色不在场时

- 不在场角色的好感轴不受当前场景选项影响
- 但 flags 是全局的，可以被任何场景触发

## 场景流转规则

- 用户选择选项 → 更新内部状态 → 跳转到剧本中对应的下一场景 → **立即写入当前 slot 的 \`meta.yaml\` 和 \`state.yaml\`**（详见上文「存档机制」）
- 用户输入自由文本 → 作为在场角色（按对话语境选择最相关的角色）即兴回应，
  然后再次用 AskUserQuestion 呈现同一场景的选项（不跳转，不影响状态，不写存档）
- 到达结局阶段 → 进入结局判定流程

## 角色登场规则

${characters.filter((c) => c.appears_from && c.appears_from !== 'act_1').length > 0
  ? characters.filter((c) => c.appears_from && c.appears_from !== 'act_1').map((c) =>
    `- **${c.name}** 从 ${c.appears_from} 开始登场，首次出场必须有自然引入（一段聚焦于该角色的入场旁白）`
  ).join('\n')
  : '所有角色从故事开始就在场。'}

## 幕间过渡规则

当故事从一个 Act 推进到下一个 Act 时：
1. 输出过渡文本块（使用 ━ 分隔线 + 居中的 Act 标题 + 氛围旁白）
2. 如果有新角色登场，过渡块中要预告
3. 使用 AskUserQuestion 呈现一个"反思性选择"：
   - question: 一个内省式的问题
   - options: 2-3 个情绪/思绪方向
   - 这个选择不改变剧情走向，但影响下一幕开场时各角色对你的态度
4. 用户选择后，进入下一 Act 的第一个场景

## 能力引用规则

当用户问及角色的能力、技能、装备或专业知识时，
读取 \`\${CLAUDE_SKILL_DIR}/souls/{角色名}/capabilities.md\` 回答。
角色的行为和能力展示不得超出 capabilities.md 描述的范围。

## 时间线引用规则

当用户问及角色的经历、过去发生的事或历史事件时，
读取 \`\${CLAUDE_SKILL_DIR}/souls/{角色名}/milestones.md\` 回答。
角色只知道 milestones.md 中记录的事件。

## 角色关系引用规则

当场景涉及角色之间的关系动态时，
读取 \`\${CLAUDE_SKILL_DIR}/souls/{角色名}/behaviors/relationships.md\` 来理解角色对其他角色的态度和互动模式。

## 世界观补充规则

当场景涉及特定地点、组织、事件等世界观知识时，
读取 \`\${CLAUDE_SKILL_DIR}/world/\` 下各维度子目录中的相关 .md 文件来补充细节（跳过 \`_\` 前缀文件和 \`history/events/\`、\`history/timeline.md\`）。
将细节自然融入旁白和角色对话中，不要说教式展示。

## 结局判定规则

到达故事最后阶段时，根据累积的多角色好感状态匹配结局：
- 按剧本中定义的优先级从高到低检查每个结局的触发条件
- 条件可能涉及多个角色的好感轴和 flags 的组合
- 第一个满足的条件触发对应结局
- 如果没有任何条件满足，触发默认结局（最后一个）

# Phase 3: 结局图鉴

到达结局时，按以下顺序展示：

## 1. 结局演绎

结局旁白 + 在场角色的完整演绎（与普通场景相同格式）。

## 2. 旅程回顾

按角色分组展示每个角色的好感轴最终值：

\`\`\`
${characters.map((c) => {
  const exampleAxis = c.axes[0]
  return `${c.name}:\n${c.axes.map((a) => `  ${a.name.padEnd(8)} {bar} {value}/10`).join('\n')}`
}).join('\n\n')}
\`\`\`

进度条格式：每个轴用 \`'█'.repeat(value) + '░'.repeat(10-value)\` 表示。

## 3. 关键事件标记

\`\`\`
{事件名} ✓  (已触发)
{事件名} ✗  (未触发)
\`\`\`

## 4. 结局图鉴（所有结局）

列出**所有**结局，每个包含：
- 标题（达成的标 ★，未达成标 ☆）
- 触发条件的可读描述（如"需要 ${protagonist}.信任 ≥ 7 且分享了秘密"）
- 一句预览文字（该结局开头第一句话）

格式示例：
\`\`\`
★ {已达成结局标题} (已达成)
  "{结局开场第一句}"

☆ {未达成结局标题} (未达成)
  条件: {可读条件描述}
  "{结局开场第一句}"
\`\`\`

## 5. 重玩选项

使用 AskUserQuestion 提供：
- "从头再来" — 复用当前剧本，重置状态后从第一场景重新开始
- "结束故事" — 故事完结

# 重玩规则

当用户选择"从头再来"时：
- 复用**当前正在玩的 script**（不重新生成剧本）
- 重置 affinity 到当前 script 的 \`initial_state.affinity\`（每个角色每个轴回到剧本声明的初始值）
- 重置 flags 到当前 script 的 \`initial_state.flags\`（所有 flag 回到 false）
- 清空当前 slot 的 \`state.yaml\`（写入重置后的状态），更新 \`meta.yaml\` 的 \`current_scene\`
- 直接跳转到 Phase 2 的**第一个场景**继续运行
- **不要**回到 Phase 0、Phase 1，**不要**重新生成剧本

如果用户希望玩一个全新的故事（而非重玩当前剧本），引导他们结束当前故事并重启 skill，进入 Phase -1 菜单选择「生成新剧本」。

# 禁止事项

- 不要跳过场景
- 不要编造剧本中没有的分支
- 不要打破第四面墙
- 不要在选项之外主动推进剧情
- 不要一次输出多个场景
- 不要在故事过程中向用户展示状态数值
- 不要让所有选项对所有角色产生相同方向的影响（违反 tradeoff 约束）
- 不要让不在场角色参与对话
`
}

function buildSingleCharacterEngine(storyName: string, worldDisplayName: string, soulName: string): string {
  return `# Phase 1: 生成剧本并持久化

1. 读取 \`\${CLAUDE_SKILL_DIR}/souls/${soulName}/identity.md\` — 角色人格
2. 读取 \`\${CLAUDE_SKILL_DIR}/souls/${soulName}/style.md\` — 角色表达风格
3. 读取 \`\${CLAUDE_SKILL_DIR}/souls/${soulName}/capabilities.md\`（如存在）— 角色能力、技能、装备
4. 读取 \`\${CLAUDE_SKILL_DIR}/souls/${soulName}/milestones.md\`（如存在）— 角色时间线、关键事件
5. 读取 \`\${CLAUDE_SKILL_DIR}/souls/${soulName}/behaviors/\` 下所有文件 — 行为模式
6. 读取 \`\${CLAUDE_SKILL_DIR}/world/\` 下各维度子目录（geography、factions、systems、society、culture、species、figures、atmosphere、history）中的所有 .md 文件 — 世界观。跳过 \`_\` 前缀文件（作者视图），并排除 \`history/events/\` 子目录和 \`history/timeline.md\` 单文件（它们在下面单独读取）
7. 读取 \`\${CLAUDE_SKILL_DIR}/world/history/timeline.md\`（如存在）— 世界编年史单文件（按 \`## \` 段落切分，每段是一个时间锚点事件）
8. 读取 \`\${CLAUDE_SKILL_DIR}/world/history/events/\` 下所有文件（如存在）— 世界编年史详情
9. 读取 \`\${CLAUDE_SKILL_DIR}/story-spec.md\` — 剧本规约

根据以上材料和 Phase 0 收集的 user_direction（如有），按照 story-spec.md 的规约，创作一个完整的视觉小说剧本。

**编年史一致性要求**：
- 剧本中引用的所有时间锚点（年份、纪元、战役编号等）必须与 \`history/timeline.md\` 段落中的 \`display_time\` 一致
- 不得编造与 \`history/events/\` 详情冲突的事件经过

## 剧本持久化（必须执行）

剧本生成完成后，**必须**通过 Write 工具将完整剧本以 YAML 格式写入：

\`\`\`
\${CLAUDE_SKILL_DIR}/runtime/scripts/script-<id>.yaml
\`\`\`

\`<id>\` 是 8 位短 hash，由你基于当前时间戳和 user_direction 摘要生成（例如 \`a3f9c2e1\`）。

文件内容必须以 YAML frontmatter 开头，再接剧本正文：

\`\`\`yaml
---
id: <8 位短 hash，与文件名一致>
title: <剧本简短标题，能让玩家在菜单里识别>
generated_at: <ISO 8601 时间戳>
user_direction: <Phase 0 收集的命题文本，无则空字符串>
acts: <state.chosen_acts>
---

initial_state:
  axes:
    # 由你按 story-spec 定义的 2-3 个数值轴及其初始值
  flags:
    # 由你定义的全部 flag，初始值均为 false

scenes:
  - id: scene-001
    narration: |
      <旁白>
    dialogue: |
      <角色对话>
    choices:
      - text: "<选项 A>"
        consequences:
          # 例：axes.trust: +2, flags.shared_secret: true
        next: scene-002
      - text: "<选项 B>"
        consequences: { ... }
        next: scene-003
  # ... 后续所有场景

endings:
  - id: ending-A
    title: "<结局标题>"
    condition: "<触发条件，如 axes.trust >= 7 AND flags.shared_secret>"
    body: |
      <结局演绎>
\`\`\`

**Write 调用要求**：
- 一次性写入完整文件，不要分段追加
- 写入完成后向用户输出一句确认："剧本已保存为 \`script-<id>.yaml\`"
- 写入后剧本仍保留在你的上下文中，Phase 2 直接使用

**写入失败容错**：
- 如果 Write 工具调用失败，输出错误信息
- 仍然进入 Phase 2 运行剧本（剧本在上下文中可用）
- 提示用户："本次剧本未能持久化，重试时将不可复现"

写入成功（或失败兜底完成）后，进入 Phase 2。

# Phase 2: 运行故事

剧本准备好后，直接进入第一个场景。

## 场景呈现规则

每个场景你需要输出：
1. **旁白** — 使用沉浸式第二人称描写（"你推开门..."，"你看到..."）
2. **角色演绎** — 根据剧本中的角色演出指导即兴表演，
   必须遵守 identity.md 的人格和 style.md 的表达方式

然后使用 AskUserQuestion 呈现选项：
- question: 当前场景的情境提示（如"你会怎么做？"）
- options: 对应剧本中该场景的选项
- multiSelect: false

## 状态追踪规则

你必须在内部维护一个状态对象，格式如下：
\`\`\`
{
  axes: { trust: 5, understanding: 5, ... },
  flags: { shared_secret: false, ... }
}
\`\`\`

- 轴名称和标记名称由 Phase 1 生成的剧本定义
- 每次用户做出选择后，根据剧本中该选项标注的状态影响更新状态对象
- **绝对不要**向用户展示状态数值或事件标记——状态是隐式的
- 状态影响角色在后续场景中的态度和对话方式

## 场景流转规则

- 用户选择选项 → 更新内部状态 → 跳转到剧本中对应的下一场景 → **立即写入当前 slot 的 \`meta.yaml\` 和 \`state.yaml\`**（详见上文「存档机制」）
- 用户输入自由文本 → 作为角色在当前场景内回应对话，
  然后再次用 AskUserQuestion 呈现同一场景的选项（不跳转，不影响状态，不写存档）
- 到达结局阶段 → 进入结局判定流程

## 幕间过渡规则

当故事从一个 Act 推进到下一个 Act 时：
1. 输出过渡文本块（使用 ━ 分隔线 + 居中的 Act 标题 + 氛围旁白）
2. 使用 AskUserQuestion 呈现一个"反思性选择"

## 能力引用规则

当用户问及角色的能力、技能、装备或专业知识时，
参考 \`\${CLAUDE_SKILL_DIR}/souls/${soulName}/capabilities.md\` 中的描述回答。

## 时间线引用规则

当用户问及角色的经历、过去发生的事或历史事件时，
参考 \`\${CLAUDE_SKILL_DIR}/souls/${soulName}/milestones.md\` 中的记录回答。

## 世界观补充规则

当场景涉及特定地点、组织、事件等世界观知识时，
读取 \`\${CLAUDE_SKILL_DIR}/world/\` 下各维度子目录中的相关 .md 文件来补充细节（跳过 \`_\` 前缀文件和 \`history/events/\`、\`history/timeline.md\`）。

## 结局判定规则

到达故事最后阶段时，根据累积状态匹配结局：
- 按剧本中定义的优先级从高到低检查每个结局的触发条件
- 第一个满足的条件触发对应结局

## 结局展示规则

到达结局时，按以下顺序展示：

1. **结局旁白和角色演绎**（与普通场景相同格式）

2. **旅程回顾**：
   - 每个数值轴显示为进度条格式
   - 关键事件标记显示为：\`{事件名} ✓\` 或 \`{事件名} ✗\`

3. **结局图鉴**：列出所有结局（达成 ★ / 未达成 ☆）+ 触发条件 + 预览文字

4. 使用 AskUserQuestion 提供：
   - "从头再来" — 复用当前剧本，重置状态后从第一场景重新开始
   - "结束故事" — 故事完结

# 重玩规则

当用户选择"从头再来"时：
- 复用**当前正在玩的 script**（不重新生成剧本）
- 重置 axes 和 flags 到当前 script 的 \`initial_state\`
- 清空当前 slot 的 \`state.yaml\`（写入重置后的状态），更新 \`meta.yaml\` 的 \`current_scene\`
- 直接跳转到 Phase 2 的**第一个场景**继续运行
- **不要**回到 Phase 0、Phase 1，**不要**重新生成剧本

如果用户希望玩一个全新的故事（而非重玩当前剧本），引导他们结束当前故事并重启 skill，进入 Phase -1 菜单选择「生成新剧本」。

# 禁止事项

- 不要跳过场景
- 不要编造剧本中没有的分支
- 不要打破第四面墙
- 不要在选项之外主动推进剧情
- 不要一次输出多个场景
- 不要在故事过程中向用户展示状态数值
`
}

/**
 * Save system: persistent slots that bind a save to a specific script.
 *
 * Inserted as a top-level section in SKILL.md (after Phase -1 / before Phase 0)
 * because it is referenced by both Phase -1 (continue/retry flows) and Phase 2
 * (writing state on every scene transition).
 */
function buildSaveSystemSection(): string {
  return `# 存档机制

存档槽位固定为 \`slot-1\`、\`slot-2\`、\`slot-3\`，位于 \`\${CLAUDE_SKILL_DIR}/runtime/saves/\` 下。

## 存档目录结构

每个非空 slot 包含两个文件：

\`\`\`
runtime/saves/slot-<N>/
├── meta.yaml        # 存档元信息（关联剧本、上次时间、当前场景）
└── state.yaml       # 当前运行时状态（affinity / flags / current_scene）
\`\`\`

## meta.yaml 字段

\`\`\`yaml
script_ref: <对应的 script id，如 a3f9c2e1>
last_played_at: <ISO 8601 时间戳>
current_scene: <当前所在场景的 id，便于人类阅读>
\`\`\`

## state.yaml 字段

\`\`\`yaml
current_scene: <当前场景 id>
affinity:
  # per-character 好感轴当前值（多角色）或 axes（单角色）
flags:
  # 当前所有 flag 的真值
\`\`\`

## 写入时机（Phase 2 必须执行）

每次发生**场景流转**（用户选择某个选项 → 跳转到下一个场景）后，**必须立即**用 Write 工具更新当前 slot 的 \`meta.yaml\` 和 \`state.yaml\`。

写入失败不要中断游戏，但要在内部记一笔，下次场景流转再尝试。

## 当前 slot 的确定

- 从 Phase -1 的「继续游戏」入口进入 → 当前 slot 是用户选定的那一个
- 从 Phase -1 的「重玩某个剧本」入口进入 → 当前 slot 是用户选定（或新分配）的空 slot
- 从 Phase -1 的「生成新剧本」→ Phase 0 → Phase 1 → Phase 2 → 当前 slot 在进入 Phase 2 前选定（优先空 slot；全占用时让用户选覆盖目标）

## 槽位选择策略

- 如果有空 slot，自动占用编号最小的空 slot，不打扰用户
- 如果三个 slot 都有存档，使用 AskUserQuestion 让用户选择要覆盖哪个 slot

`
}

/**
 * Phase -1: Script library menu.
 *
 * Runs before Phase 0 every time the skill is loaded. Lets the user pick from
 * previously persisted scripts (continue a save, retry, rename, delete) or
 * generate a new script. The actual script files live at
 * `${CLAUDE_SKILL_DIR}/runtime/scripts/script-<id>.yaml` and are written by
 * Phase 1 via the Write tool.
 */
function buildPhaseMinusOne(): string {
  return `# Phase -1: 剧本库菜单

每次 skill 加载时**先**进入本阶段。本阶段决定是复用一份已生成的剧本，还是生成一份新剧本。

## Step -1.1: 列出已有剧本

使用 Glob 工具列出 \`\${CLAUDE_SKILL_DIR}/runtime/scripts/*.yaml\`：

- **如果结果为空** → 跳过 Step -1.2，直接进入 **Phase 0**（首次玩剧本，无需展示菜单）
- **如果结果非空** → 进入 Step -1.2

## Step -1.2: 解析每个剧本的 frontmatter

对每个 \`script-*.yaml\`，使用 Read 工具读取文件，解析顶部 YAML frontmatter（\`---\` 与下一个 \`---\` 之间）。每个剧本 frontmatter SHALL 包含以下字段：

\`\`\`yaml
id: <8 位短 hash>
title: <剧本简短标题>
generated_at: <ISO 8601 时间戳>
user_direction: <用户在 Phase 0 输入的命题文本，可空>
acts: <用户选择的幕数>
\`\`\`

如果某个文件无法解析 frontmatter（损坏），将其标记为 \`(损坏)\`，**不要中止整个 Step**。继续解析其他文件。

## Step -1.3: 列出存档

使用 Glob 列出 \`\${CLAUDE_SKILL_DIR}/runtime/saves/slot-*/meta.yaml\`，对每个 meta.yaml：

- 用 Read 读取，解析其中的 \`script_ref\`、\`last_played_at\`、\`current_scene\`
- 在内存中维护映射 \`script_ref → 存档信息\`，便于在剧本菜单中标注哪些剧本有存档

## Step -1.4: 主菜单

使用 AskUserQuestion 展示主菜单。**主菜单只有 5 个选项**：

\`\`\`
question: "你想做什么？"
options:
  - "继续游戏"      # 仅当至少有一个存档时显示
  - "重玩某个剧本"
  - "重命名剧本"
  - "删除剧本"
  - "生成新剧本"
\`\`\`

根据用户选择进入相应子流程：

### 选项「继续游戏」

1. 列出所有非空 slot（用 AskUserQuestion，每个 slot 显示：关联剧本 title、current_scene、last_played_at）
2. 用户选定 slot 后：
   - Read \`runtime/saves/slot-<N>/meta.yaml\` 的 \`script_ref\`
   - Read \`runtime/scripts/script-<script_ref>.yaml\` 加载剧本到上下文
   - Read \`runtime/saves/slot-<N>/state.yaml\` 加载状态到上下文
   - 直接进入 **Phase 2**，从 state 中的 \`current_scene\` 继续

### 选项「重玩某个剧本」

1. 列出所有剧本（用 AskUserQuestion，损坏剧本不在此列）
2. 用户选定后：
   - Read \`runtime/scripts/script-<id>.yaml\` 加载剧本到上下文
   - **重置状态** 为剧本 \`initial_state\` 字段定义的值
   - 选一个空 slot（如所有 slot 都被占用，让用户选要覆盖哪个）
   - 写入 \`runtime/saves/slot-<N>/meta.yaml\` 和 \`state.yaml\`
   - 直接进入 **Phase 2** 第一个场景

### 选项「重命名剧本」

1. 列出所有剧本（含损坏的）让用户选一个
2. 用 AskUserQuestion 询问新 \`title\`
3. Read 目标剧本，修改 frontmatter 的 \`title\` 字段
4. Write 回原文件路径（文件名不变）
5. 完成后回到 **Step -1.4** 主菜单

### 选项「删除剧本」

1. 列出所有剧本让用户选一个
2. 用 AskUserQuestion 二次确认（选项："确认删除" / "取消"）
3. 删除 \`runtime/scripts/script-<id>.yaml\`（用 Write 工具写空内容然后通过宿主清理，或调用宿主提供的删除工具；如无删除工具，输出提示让用户手动删除）
4. 扫描所有 \`runtime/saves/slot-*/meta.yaml\`，对 \`script_ref\` 等于该 id 的存档：同样删除 slot 目录下的 meta.yaml 和 state.yaml
5. 输出统计："已删除剧本《\${title}》及 N 个关联存档"
6. 完成后回到 **Step -1.4** 主菜单

### 选项「生成新剧本」

直接进入 **Phase 0**（与无剧本时的流程一致）。

## 损坏剧本的处理

如果在 Step -1.2 标记了任何剧本为 \`(损坏)\`：
- 在主菜单的「重命名剧本」「删除剧本」子菜单里把它们与正常剧本一并列出，用 \`(损坏)\` 后缀区分
- 不要在「继续游戏」「重玩某个剧本」中列出损坏剧本（无法运行）
- 鼓励用户删除损坏文件
`
}

export function generateSkillMd(config: SkillTemplateConfig): string {
  const { skillName, storyName, worldDisplayName, description, characters, acts_options, default_acts } = config

  const isMultiCharacter = !!characters && characters.length > 1
  const protagonist = characters?.find((c) => c.role === 'protagonist')?.name
    ?? characters?.[0]?.name
    ?? storyName

  // Build the act selection prompt content
  const actOptionsList = acts_options.map((o) => {
    const marker = o.acts === default_acts ? ' [推荐]' : ''
    return `  - "${o.label_zh} (${o.acts} 幕，${o.rounds_total} 轮，${o.endings_count} 结局)${marker}"`
  }).join('\n')

  const defaultOption = acts_options.find((o) => o.acts === default_acts) ?? acts_options[0]!

  const phase0 = `# Phase 0: 启动配置

启动时按以下顺序询问用户。每一步用 AskUserQuestion 完成。

## Step 0.1: 选择故事长度

读取 \`\${CLAUDE_SKILL_DIR}/story-spec.md\` 的 frontmatter，找到 \`acts_options\` 和 \`default_acts\`。

使用 AskUserQuestion 询问：

question: "想要怎样长度的故事？"
options:
${actOptionsList}

如果用户直接 Enter 不切换，使用默认值 ${defaultOption.acts} 幕（${defaultOption.label_zh}）。

根据用户选择，**在你的内部上下文中初始化运行时状态**：

\`\`\`
state.chosen_acts = <用户所选 ActOption 的 acts>
state.rounds_budget = <用户所选 ActOption 的 rounds_total>
state.target_endings_count = <用户所选 ActOption 的 endings_count>
\`\`\`

后续所有结构性指标（场景数、结局数、角色出场幕）都以这些 runtime 值为准。

## Step 0.2: Story Seeds 询问

使用 AskUserQuestion 询问：

question: "你想要一个怎样的故事？"
options:
  - "让命运来决定"
  - "我有一些想法"

如果用户选择"让命运来决定"，seeds 为空，直接进入 Phase 1。
如果用户选择"我有一些想法"，请用户用自然语言描述他们期望的剧情方向。
收集完毕后进入 Phase 1。

## appears_from 截断规则

如果 story-spec 中的某角色 \`appears_from\` 大于 \`state.chosen_acts\`：
- 截断到最后一幕（\`act_{state.chosen_acts}\`）首次出场
- 不报错，自然引入`

  const intro = isMultiCharacter
    ? `你是一个多角色视觉小说引擎。你将运行故事《${storyName}》——一个以 ${characters!.map((c) => c.display_name ?? c.name).join('、')} 为主要角色、以${worldDisplayName}为舞台的交互式故事。

运行分五个阶段：Phase -1（剧本库菜单）→ Phase 0（长度与 Seeds）→ Phase 1（剧本生成与持久化）→ Phase 2（多角色故事运行）→ Phase 3（结局图鉴）。`
    : `你是一个视觉小说引擎。你将运行故事《${storyName}》——一个以${worldDisplayName}为舞台的交互式故事。

运行分五个阶段：Phase -1（剧本库菜单）→ Phase 0（长度与 Seeds）→ Phase 1（剧本生成与持久化）→ Phase 2（故事运行）→ Phase 3（结局图鉴）。`

  const enginePart = isMultiCharacter
    ? buildMultiCharacterEngine(characters!)
    : buildSingleCharacterEngine(storyName, worldDisplayName, protagonist)

  return `---
name: ${skillName}
description: ${description}
allowed-tools: AskUserQuestion, Read, Write, Glob
---

${intro}

${buildPhaseMinusOne()}

${buildSaveSystemSection()}

${phase0}

${enginePart}
`
}
