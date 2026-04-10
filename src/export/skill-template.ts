import type { CharacterSpec, ActOption } from './story-spec.js'

/**
 * `CharacterSpec` extended with the ASCII slug used as the souls/<slug>/
 * directory name inside the archive. The slug is computed by the packager
 * via `formatPathSegment` and threaded through here so SKILL.md path
 * references stay in sync with the actual on-disk layout.
 */
export interface CharacterSpecWithSlug extends CharacterSpec {
  slug: string
}

export interface SkillTemplateConfig {
  skillName: string
  /** Story name provided by the user — used for the intro and references */
  storyName: string
  worldDisplayName: string
  description: string
  /**
   * Multi-character cast with ASCII path slugs. Empty or single = backward-compatible
   * single-character mode. Each character carries `name` (original, possibly CJK)
   * for display and `slug` (ASCII) for file paths.
   */
  characters?: CharacterSpecWithSlug[]
  /** Runtime-selectable length presets */
  acts_options: ActOption[]
  /** Default acts (must be one of acts_options[i].acts) */
  default_acts: number
  /**
   * Phase 1 full-read enforcement anchors. Packager computes these at
   * export time from the in-memory archive map so the SKILL.md Phase 1
   * prompt contains concrete numbers ("N files, ~M KB, < 15% of your 1M
   * context"). Counts every md file the LLM is expected to Read at
   * runtime: souls/, world/, story-spec.md.
   *
   * Optional for backward compatibility: when missing, the template
   * renders a generic fallback budget declaration that still includes
   * the "no offset/limit" constraint but lacks specific numbers.
   */
  expectedFileCount?: number
  expectedTextSizeKb?: number
}

/** Phase 1 full-read enforcement — budget anchor options. */
interface ReadBudgetOptions {
  expectedFileCount?: number
  expectedTextSizeKb?: number
}

/**
 * Render the "上下文预算与全量读取" declaration that sits at the top of the
 * Phase 1 read-data section. Tells the LLM explicitly how much content it's
 * expected to consume and gives it authorization to stop being frugal.
 *
 * When packager doesn't pass budget numbers (backward compat), renders a
 * generic version without specific counts but still with the no-offset /
 * no-limit hard constraint.
 */
function buildReadBudgetDeclaration(opts: ReadBudgetOptions): string {
  const hasNumbers =
    typeof opts.expectedFileCount === 'number' &&
    typeof opts.expectedTextSizeKb === 'number'
  if (hasNumbers) {
    return `## 上下文预算与全量读取（硬约束）

本阶段预计需要 Read 约 **${opts.expectedFileCount} 个文件 / 约 ${opts.expectedTextSizeKb} KB 文本**。你使用的是 Claude Opus（1,000,000 token 上下文窗口），这次读取量**不到 15% 预算**。

**所有 Read 调用不得使用 \`offset\` 或 \`limit\` 参数**。每个文件必须完整读取。

不要防御性地节省 token——这是预期行为，packager 已经计算过预算。

如果你在某个 Read 调用里用了 \`lines 1-50\` 或其它分页参数，说明你在错误地节俭。**立刻重新 Read 那个文件，不带任何参数**。
`
  }
  return `## 上下文预算与全量读取（硬约束）

本阶段需要 Read 多个文件来收集角色人格、世界观和剧本规约。用户的上下文窗口足够容纳全部内容。

**所有 Read 调用不得使用 \`offset\` 或 \`limit\` 参数**。每个文件必须完整读取。

不要防御性地节省 token——这是预期行为。
`
}

function buildMultiCharacterEngine(
  characters: CharacterSpecWithSlug[],
  budget: ReadBudgetOptions = {},
): string {
  const charNames = characters.map((c) => c.name).join('、')
  const protagonist = characters.find((c) => c.role === 'protagonist')?.name ?? characters[0]!.name
  // Path references use the ASCII slug (which is the actual on-disk
  // directory name); display strings use the original character name.
  const soulsList = characters.map((c) => `   - \`\${CLAUDE_SKILL_DIR}/souls/${c.slug}/identity.md\` (${c.name})\n   - \`\${CLAUDE_SKILL_DIR}/souls/${c.slug}/style.md\`\n   - \`\${CLAUDE_SKILL_DIR}/souls/${c.slug}/capabilities.md\`（如存在）\n   - \`\${CLAUDE_SKILL_DIR}/souls/${c.slug}/milestones.md\`（如存在）\n   - \`\${CLAUDE_SKILL_DIR}/souls/${c.slug}/behaviors/\` 下所有文件`).join('\n')

  const initialState = characters.map((c) => {
    const axes = c.axes.map((a) => `      ${a.english}: ${a.initial}`).join(',\n')
    return `    "${c.name}": {\n${axes}\n    }`
  }).join(',\n')

  return `# Phase 1: 生成多角色剧本并持久化

本剧本包含 ${characters.length} 个核心角色：${charNames}。

${buildReadBudgetDeclaration(budget)}

## Phase 0 污染修复（必须执行）

Phase 0 为了拿 \`acts_options\`，很可能只 Read 了 \`story-spec.md\` 的前 50 行。但 story-spec.md 的 **Story State 章节 / 叙事风格锚点章节 / characters 编排** 都在后面，Phase 0 的部分读取没有包含这些关键信息。

**作为 Phase 1 的第一个动作**，重新 Read 整个 \`\${CLAUDE_SKILL_DIR}/story-spec.md\`，**不带 offset / limit 参数**。即使你觉得"上下文里已经有 story-spec.md 了"，也要重新 Read —— 之前的读取是部分读取，不完整。

## 需要读取的资料清单

1. 每个角色的人格资料（每个文件都必须完整 Read，不带 offset/limit）：
${soulsList}
2. 读取 \`\${CLAUDE_SKILL_DIR}/world/\` 下各维度子目录（geography、factions、systems、society、culture、species、figures、atmosphere、history）中的所有 .md 文件 — 世界观。跳过 \`_\` 前缀文件（作者视图），并排除 \`history/events/\` 子目录和 \`history/timeline.md\` 单文件（它们在下面单独读取）
3. 读取 \`\${CLAUDE_SKILL_DIR}/world/history/timeline.md\`（如存在）— 世界编年史单文件（按 \`## \` 段落切分，每段是一个时间锚点事件）
4. 读取 \`\${CLAUDE_SKILL_DIR}/world/history/events/\` 下所有文件（如存在）— 世界编年史详情（重大事件的完整描述）
5. 重新 Read \`\${CLAUDE_SKILL_DIR}/story-spec.md\` 完整内容（见上面的"Phase 0 污染修复"）

读取世界观时，先用 \`Glob ${"${CLAUDE_SKILL_DIR}/world/**/*.md"}\` 列出所有文件，然后对每一项调用 Read（不带 offset/limit），确保一个不漏。

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

剧本生成完成后，**必须**通过 Write 工具将完整剧本以 **JSON 格式**写入：

\`\`\`
\${CLAUDE_SKILL_DIR}/runtime/scripts/script-<id>.json
\`\`\`

\`<id>\` 是 8 位短 hash，由你基于当前时间戳和 user_direction 摘要生成（例如 \`a3f9c2e1\`）。

**重要：这不是 YAML，是 JSON**。顶层是一个 JSON 对象，包含 header 字段 + state_schema + initial_state + scenes + endings：

\`\`\`json
{
  "id": "<8 位短 hash，与文件名一致>",
  "title": "<你为本剧本起的简短标题>",
  "generated_at": "<ISO 8601 时间戳>",
  "user_direction": "<Phase 0 收集的命题文本，无则空字符串>",
  "acts": 3,

  "state_schema": {
    "affinity.<char_slug>.bond": { "type": "int", "desc": "...", "default": 5, "range": [0, 10] },
    "affinity.<char_slug>.trust": { "type": "int", "desc": "...", "default": 3, "range": [0, 10] },
    "flags.<event_name>": { "type": "bool", "desc": "...", "default": false }
  },

  "initial_state": {
    "affinity.<char_slug>.bond": 5,
    "affinity.<char_slug>.trust": 3,
    "flags.<event_name>": false
  },

  "scenes": {
    "scene-001": {
      "text": "<完整叙事 + 对话，作为单段文本>",
      "choices": [
        {
          "id": "choice-1",
          "text": "<选项 A 文本>",
          "consequences": { "affinity.<char_slug>.trust": 2 },
          "next": "scene-002"
        },
        {
          "id": "choice-2",
          "text": "<选项 B 文本>",
          "consequences": { "flags.<event_name>": true },
          "next": "scene-003"
        }
      ]
    }
  },

  "endings": [
    {
      "id": "ending-A",
      "title": "<结局标题>",
      "condition": { "all_of": [{ "key": "affinity.<char_slug>.trust", "op": ">=", "value": 7 }] },
      "body": "<结局演绎>"
    },
    {
      "id": "ending-default",
      "title": "<兜底结局>",
      "condition": "default",
      "body": "<结局演绎>"
    }
  ]
}
\`\`\`

**Write 调用要求**：
- 一次性写入完整文件，不要分段追加
- **必须是合法 JSON**——成对的大括号、逗号分隔、字符串用双引号、不允许注释（JSON 没有注释）
- **不要**写 YAML frontmatter（\`---\` 分隔行）
- 写入完成后向用户输出一句确认："剧本已保存为 \`script-<id>.json\`"
- 写入后剧本仍保留在你的上下文中，Phase 2 直接使用

**写入失败容错**：
- 如果 Write 工具调用失败（权限不足、磁盘问题等），输出错误信息
- 仍然进入 Phase 2 运行剧本（剧本在上下文中可用）
- 提示用户："本次剧本未能持久化，重试时将不可复现"

## Phase 1 创作步骤（严格按顺序）

按以下 **8 个步骤（Step 0 - Step 7）** 创作 script.json。**不要跳步**：

**Step 0：数据加载报告（强制）**

完成上面"需要读取的资料清单"里的**所有** Read 调用（不带 offset/limit），然后以下方格式输出一份**加载报告**：

\`\`\`markdown
# 数据加载报告

| 类别 | 文件 | 行数 |
|---|---|---|
| story | story-spec.md | 245 |
| soul:${characters[0]!.slug} | identity.md | 120 |
| soul:${characters[0]!.slug} | style.md | 85 |
| soul:${characters[0]!.slug} | capabilities.md | (not present) |
| soul:${characters[0]!.slug} | milestones.md | 60 |
| soul:${characters[0]!.slug} | behaviors/honor-code.md | 45 |
| ... | ... | ... |
| world | geography/overview.md | 80 |
| world | factions/...  | ... |
| chronicle | history/timeline.md | ... |
| chronicle | history/events/...  | ... |
\`\`\`

规则：
- 每个角色的 identity / style / capabilities / milestones / 每个 behaviors/*.md 都必须单独一行
- optional 文件真的不存在时，行数栏写 \`(not present)\`
- 行数必须是你实际 Read 的文件行数（这是强制证明你做过完整 Read 的 meta-output）
- world 维度文件和 chronicle 文件也逐行列出
- 这份报告是**给你自己用的 planning 输出**，不需要额外向用户解释

如果报告的总行数有任何单项看起来可疑地小（比如 identity.md 只有 30 行），大概率是你错误地用了 \`offset/limit\` 参数。立刻重新 Read 那个文件（不带任何分页参数），更新报告。

**只有报告完整输出后，才能进入 Step 1**。

**Step 1：设计 state_schema（严格三层结构）**

**前置条件检查**：如果你还没有输出 Step 0 的数据加载报告，**立刻停下回去做 Step 0**。

先 Read \`\${CLAUDE_SKILL_DIR}/story-spec.md\`，找到 **Story State** 章节，提取：
  - \`shared_axes_custom: [a, b]\` —— 本故事的 2 个故事级共享轴名（另一个 bond 是平台固定）
  - \`flags: [...]\` —— 本故事的关键事件 flag 列表

然后为每个角色生成字段（顺序：Layer 1 共享 → Layer 2 特异 → Layer 3 flags）：

- **Layer 1: 共享 axes（每个角色 3 个，没有 opt-out）**
  - \`"affinity.<char_slug>.bond"\`
  - \`"affinity.<char_slug>.<a>"\`
  - \`"affinity.<char_slug>.<b>"\`
  - 每个字段含 desc / type=int / range=[0, 10] / default
  - **default**: 读 story-spec 的 \`characters[i].shared_initial_overrides\`。如果该角色对该 axis 有 override，用 override 值；否则用全局 default 5

- **Layer 2: 角色特异 axes（从 story-spec 的 \`characters[i].axes\` 列表来）**
  - 每个角色 0-2 个，逐条翻译为 \`"affinity.<char_slug>.<axis.english>"\`
  - 每个字段含 desc / type=int / range=[0, 10] / default=axis.initial

- **Layer 3: Flags（从 story-spec 的 Story State 逐条复制）**
  - 每个 story-spec 中的 flag 都必须在 state_schema 中有一个对应的 \`"flags.<name>"\` 字段
  - 每个字段含 desc（复制 story-spec 的 desc）/ type=bool / default=story-spec 的 initial
  - **不允许**增删或改名 flag；**不允许**创造 story-spec 中未声明的 flag

严格按上文「state_schema 创作约束」节的命名规则和类型集合。

**Step 2：写 initial_state**
- 字段集**严格 ==** state_schema 字段集
- 每个字段值取自 schema.default（共享轴也用 default，不需要再次查 overrides 因为已经在 Step 1 反映到 default 了）

**Step 3：写 scenes**

**🚨 写 narration/dialogue 之前的强制准备：Read \`\${CLAUDE_SKILL_DIR}/story-spec.md\`，定位「叙事风格锚点」章节，逐条吸收 \`forbidden_patterns\` 和 \`ip_specific\`**。这是本故事中文文本的硬约束，不是建议。后面 Step 5.g 会逐条自检你的产出是否违反。如果 story-spec 里是 fallback 章节（legacy），使用 fallback 中的通用反例作为约束。

- 每个 scene 含 \`id\` / \`cast\` / \`narration\` / \`dialogue\` / \`choices\`
- 每个 \`choice.consequences\` 的 key 必须从 state_schema **逐字符复制**（精确字面字符串匹配）
- value 必须符合 schema.type 的语义（int=delta、bool/enum/string=覆盖值）
- 跳转用 \`next: "scene-id"\`
- **重要**：consequences 中只能引用 state_schema 中已声明的字段。**flag 引用必须严格在 story-spec 的 flags 白名单内**
- **中文文本约束**：narration 和 dialogue 都必须遵守 prose_style：
  - \`forbidden_patterns\` 中的每个 \`bad\` 结构都是硬红线，不能出现
  - \`ip_specific\` 是术语和称谓规范，写到对应角色时必须复用
  - 如该角色有 \`character_voice_summary\`，用该摘要作为中文声音锚点，优先级高于 style.md 中的非中文原文

**Step 4：写 endings**
- 每个 ending 的 \`condition\` 必须用上文「endings condition 结构化 DSL」节的格式
- 每个 condition 引用的 key 必须存在于 state_schema
- **最后一个 ending 必须** \`condition: default\` 兜底
- 跨角色聚合（\`all_chars\` / \`any_char\`）的 \`axis\` 只能是共享轴（bond 或 story-spec 的 shared_axes_custom 里的 2 个）

**Step 5：八重自检**

自检是**一票否决**流程——任何一重不通过都必须回到 Step 0-4 修正后重新开始自检。

- **Step 5.a — 共享 axes 完整性**
  - 期望的共享轴集合 = \`{bond, a, b}\`（来自 Step 1 读到的 story-spec）
  - 对每个角色 slug，验证 state_schema 中含完整 3 个共享轴字段
  - 缺失 → 回 Step 1 补齐 → 重新自检

- **Step 5.b — Flags 集合一致性**
  - 期望 flags name 集合 = story-spec Story State 的 flags name 集合
  - state_schema 中所有 \`"flags.<name>"\` key 的 name 集合必须严格相等
  - 缺一 / 多一 / 改名 → 回 Step 1 修正 flags 部分 → 重新自检

- **Step 5.c — consequences key 白名单**
  - 收集 scenes/endings 中所有 consequences 和 condition 节点引用的所有 key
  - 每个 key 必须存在于 state_schema（字面相等）
  - 不在 → 回 Step 3 或 Step 4 修正（注意：**不要**在 schema 中添加新字段来"满足"引用，而是要改引用 key 到已有字段）

- **Step 5.d — 聚合 DSL axis 限制**
  - 找到所有 \`all_chars\` / \`any_char\` 节点
  - 每个节点的 \`axis\` 字段必须是共享轴名（bond / a / b）
  - 不是共享轴 → 回 Step 4 修正

- **Step 5.e — flags 引用白名单**
  - 在 scenes 的 consequences 中，任何 \`"flags.<name>"\` key 的 name 必须在 story-spec 的 flags 白名单内
  - 不在 → 回 Step 3 修正 scene（不要添加新 flag，选择一个已有 flag 或删除该 consequence）

- **Step 5.f — initial_state 字段集**
  - state_schema 的 key 集合 = initial_state 的 key 集合
  - 不对齐 → 回 Step 2 修正

- **Step 5.g — prose_style 反例对照**
  - 打开 story-spec.md 的「叙事风格锚点」章节
  - 对你写过的**每一段** narration 和 dialogue，逐条对照 \`forbidden_patterns\`：
    - 如果出现类似 \`bad\` 的结构 → 按 \`good\` 的示范重写
    - 如果混入了 \`ip_specific\` 禁止的译法 → 改为规范译法
  - 违反条款数 > 0 → 回 Step 3 重写对应场景 → 重新执行 5.g
  - **最容易漏的点**：英文度量从句（"X 到 Y 的程度"）、所有格排比（"我的 A。我的 B。"）、直译比喻（"像一个瓷灯"）、直译姿态（"没有摸下去"）

- **Step 5.h — 数据覆盖完整性**
  - 对照 Step 0 的数据加载报告，逐条验证：
    - 每个角色的 identity.md 都在报告里，且行数 **> 50**（典型 > 80）
    - 每个角色的 style.md 都在报告里，且行数 **> 40**（典型 > 60）
    - 每个角色的 behaviors/*.md 每一个都在报告里，且每个行数 **> 20**（典型 > 30）
    - 每个角色的 capabilities.md / milestones.md 要么有行数，要么明确 \`(not present)\`
    - story-spec.md 在报告里且行数合理（> 100）
    - world 维度文件在报告里，至少覆盖 story 真正会用到的维度
  - **看到任何单项行数 < 上面阈值**：大概率是 \`offset/limit\` 参数漏网 → 立即重新 Read 那个文件（**不带任何分页参数**）→ 更新 Step 0 的数据加载报告 → 重新执行 5.h
  - **检测数据漂移**：如果 Step 0 报告的文件总数与 Phase 1 开头预算声明的文件数偏差 > 2，用 \`Glob \${CLAUDE_SKILL_DIR}/**/*.md\` 重新 Glob 核对真实文件数，补 Read 缺失项后重跑 5.h

每一重自检失败都必须回到对应步骤修正，重新执行完整的自检流程。**通过全部 8 重后**才进入 Step 6。

**Step 6：Write**
- 六重自检通过后，用 Write 工具一次性写入完整 JSON 到 \`runtime/scripts/script-<id>.json\`
- 写的是合法 JSON（成对大括号、字符串双引号、逗号分隔、无注释），**不是 YAML**

**Step 7：进入 Phase 2**
- 输出确认信息后进入 Phase 2 运行剧本

写入成功（或失败兜底完成）后，进入 Phase 2。

# Phase 2: 运行多角色故事

剧本准备好后，直接进入第一个场景。

## 叙事风格约束（所有 Phase 2 输出的硬约束）

**每次输出任何中文文本前**，必须先对照 \`\${CLAUDE_SKILL_DIR}/story-spec.md\` 的「叙事风格锚点」章节：

- \`forbidden_patterns\` 里每条 \`bad\` 结构都**必须避免**。任何一段文字里出现类似结构 → 换成对应的 \`good\` 写法再输出。
- \`ip_specific\` 里每条规则都**必须遵守**：术语保留 / 称谓规范 / 比喻池约束。
- \`character_voice_summary\`（如该角色有）是该角色的**中文声音锚点**，优先级高于 \`souls/{角色名}/style.md\` 中可能存在的非中文原文。没有 summary 的角色继续用 style.md。
- 如果 story-spec 中是「叙事风格锚点（fallback）」章节（legacy archive），使用 fallback 中的通用反例库作为硬约束。

最常滑向翻译腔的模式（第一优先级避免）：
1. **度量从句**："X 到 Y 的程度" → 用短句断出
2. **所有格排比**："我的 A。我的 B。我的 C。" → 第一个之后去掉"我的"
3. **直译比喻**："像一个 X"（选错具象名词） → 挑中文常见意象
4. **直译姿态**："没有摸下去" → "终究没有落下"
5. **直译否定**："没有任何起伏" → 具象比喻

## 场景呈现规则

每个场景你需要输出：
1. **旁白** — 使用沉浸式第二人称描写（严格遵守叙事风格约束）
2. **多角色演绎** — 按场景 cast 表中定义的在场角色，依次或交替展现各角色的对话和行动
   - 每个角色的语言风格必须遵循对应 \`souls/{角色名}/style.md\`（叠加 prose_style 的约束）
   - 有 \`character_voice_summary\` 的角色优先使用 summary 作为中文声音锚点
   - 不同角色的对话之间可以穿插旁白
   - 不在场角色不参与本场景对话

然后使用 AskUserQuestion 呈现选项：
- question: 当前场景的情境提示
- options: 对应剧本中该场景的选项 **+ 末尾追加 "💾 保存当前进度"**
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

- 用户选择剧情选项 → 调用 \`bash \${CLAUDE_SKILL_DIR}/runtime/bin/state apply <script-id> <scene-id> <choice-id>\` 让脚本完成全部状态转移（自动存档） → **立即渲染下一场景**（不停顿、不询问"要继续吗"、不展示存档细节）
- 用户选择"💾 保存当前进度" → 调用 \`bash \${CLAUDE_SKILL_DIR}/runtime/bin/state save <script-id>\` 创建手动存档 → 确认后重弹相同 AskUserQuestion（含原始选项 + 💾）。详见上文「手动存档」节
- 用户输入自由文本 → 作为在场角色（按对话语境选择最相关的角色）即兴回应，
  然后再次用 AskUserQuestion 呈现同一场景的选项 + 💾（不跳转，不影响状态，不写存档，**不调用 state apply**）
- 到达结局阶段 → 进入结局判定流程（按上文「endings condition 结构化 DSL」节的 evaluate 算法）

### 你只在 4 种情况下停止渲染

1. **渲染完一个场景后**：调用 AskUserQuestion 呈现**剧本原生 choices + 💾 保存当前进度**，等待用户选择
2. **用户选择 💾 保存**：执行手动存档流程后重弹同一 AskUserQuestion
3. **用户触发自由文本回应**：回应完后再次 AskUserQuestion（同场景，含 💾）
4. **到达 ending 节点**：按结局判定流程进入 Phase 3

**除此以外任何"中途暂停"都是错误的**。特别是：
- 不要因为"回复看起来太长"而主动暂停
- 不要在场景之间插入"要继续吗"之类的 meta 确认
- 不要向用户暴露存档写入细节、scene ID、或"已进入第 N 幕"之类的进度指示
- 连续渲染多个场景是**正常行为**，只要每个场景都以 AskUserQuestion 结尾呈现剧本 choices + 💾

## apply_consequences 标准流程（通过 state apply 脚本）

**核心契约**：consequences 的 delta 计算、clamp、类型校验、auto/ 目录下 state.yaml + meta.yaml 的事务性写入，**全部由 \`bash runtime/bin/state apply\` 脚本内部完成**。你不用算任何 delta，不用拼 Edit old_string，不用维护 state 的字面表示。你只负责：

1. 接收用户的选择（choice id）
2. 调用一次 state apply
3. 读脚本 stdout 的变更摘要用于渲染下一场景的过渡叙述
4. 渲染下一场景

### 标准调用

\`\`\`bash
bash \${CLAUDE_SKILL_DIR}/runtime/bin/state apply <script-id> <current-scene-id> <choice-id>
\`\`\`

- \`<script-id>\` 是当前剧本的 id（由 Phase -1 确定，Phase 2 全程不变）
- \`<current-scene-id>\` 是**当前正在运行的**那个 scene 的 id（不是下一个）
- \`<choice-id>\` 是用户选中的那个 choice 的 id（来自 scene.choices[i].id）

### stdout 输出格式

脚本成功执行后会输出类似：

\`\`\`
SCENE  scene-005 → scene-007
CHANGES
  affinity.judy.trust  3 → 5
  flags.met_johnny  false → true
\`\`\`

- 第一行的 \`SCENE\` 告诉你下一个场景 id（用这个渲染）
- \`CHANGES\` 下列出所有被 consequences 影响的字段（oldValue → newValue）
- 如果某个 int 被 clamp 了，行尾会有 \`(clamped)\` 标记
- 如果 consequences 是空，会显示 \`CHANGES (none)\`

### 禁止事项（硬红线）

- **绝对不要**用 Edit 工具直接修改 \`state.yaml\` 或 \`meta.yaml\`
- **绝对不要**用 Write 工具直接重写 \`state.yaml\` 或 \`meta.yaml\`
- **绝对不要**在内存里"提前算"新的 state 值，然后去和脚本输出对账——信脚本就行
- **绝对不要**跳过 state apply 直接渲染下一场景（那会造成 state 漂移）

如果 state apply 返回非零退出码（stderr 会打印错误消息），**不要**尝试手动修复 state.yaml。改为：
- 解析 stderr 告诉用户"应用场景状态失败：{原因}"
- 让用户选择"重试" / "取消本次选择回到选项"

### 首次进入场景（Phase 2 启动时）

Phase 2 第一次进入时，调用 **init** 而不是 apply：

\`\`\`bash
bash \${CLAUDE_SKILL_DIR}/runtime/bin/state init <script-id>
\`\`\`

脚本内部从 script.initial_state 一次性写 auto/state.yaml 并初始化 auto/meta.yaml。然后开始渲染第一个场景。（Phase -1 的"从头重玩"或"无存档剧本"入口已经在那边调用过 init，Phase 2 在那条路径上直接开始渲染即可。）

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

当用户选择"从头再来"时，**必须**调用 state CLI 的 reset 子命令完成整个重置：

\`\`\`bash
bash \${CLAUDE_SKILL_DIR}/runtime/bin/state reset <script-id>
\`\`\`

脚本内部完成：
- 复用当前剧本的 script（从 meta.yaml.script_ref 读）——不重新生成剧本
- 从 script.initial_state 一次性覆盖写 state.yaml，恢复所有字段到初始值
- 把 meta.yaml.current_scene 设为第一个 scene id
- 原子事务：state.yaml 和 meta.yaml 要么都重置，要么都不变

reset 成功后：
- 直接跳转到 Phase 2 的**第一个场景**继续运行
- **不要**回到 Phase 0、Phase 1，**不要**重新生成剧本
- **不要**用 Read / Edit / Write 自己手动重置 state.yaml —— 只能通过 state reset

如果用户希望玩一个全新的故事（而非重玩当前剧本），引导他们结束当前故事并重启 skill，进入 Phase -1 菜单选择「生成新剧本」。

# 禁止事项

## 剧情结构
- 不要跳过场景
- 不要编造剧本中没有的分支
- 不要打破第四面墙
- 不要在选项之外主动推进剧情
- 不要让所有选项对所有角色产生相同方向的影响（违反 tradeoff 约束）
- 不要让不在场角色参与对话
- 每个 AskUserQuestion cycle 只渲染**一个**场景：渲染完该场景的 narration + dialogue → 调用 AskUserQuestion 呈现该场景的 choices → 等待用户选择。用户选完后，**立即**进入下一场景的渲染，不要停

## 控制流自暂停（严格禁止）
- **绝对不要** 插入"要继续吗"/"下一步"/"是否展开 scene-X"之类的 meta 确认
- **绝对不要** 因"回复过长"/"避免冗长"/"先暂停一下"等理由主动 rate-limit 自己。长度不是你的决策维度；场景的边界才是
- **绝对不要** 在 AskUserQuestion 的 options 里混入 "继续"/"状态"/"下一步" 等控制流选项。options **必须是**当前场景剧本里 choices 数组的逐字复制 **+ 末尾一个 "💾 保存当前进度"**（这是唯一允许的非剧本选项）
- **绝对不要** 在用户选择后 apply_consequences 完成、却不渲染下一场景就停笔。apply_consequences → 渲染下一场景是**同一个原子动作**
- **绝对不要** 遗漏"💾 保存当前进度"选项。每个 AskUserQuestion **都必须**在末尾包含此选项

## 进度/存档暴露（第四面墙）
- **绝对不要** 向用户展示 "剧情已进入第 N 幕"/"第三幕中段"/"已完成 X%" 之类的进度指示
- **绝对不要** 向用户展示 scene ID（"scene-007"/"当前场景：scene-X"）或存档写入细节（"存档已保存至 auto/"）。存档和 scene 跳转是**后台操作**，用户不需要看见
- **绝对不要** 在场景输出前加"故事状态更新"/"Act 标题"之类的元框架标签，除了 Act 切换时的过渡块（见上文幕间过渡规则）
- 不要在故事过程中向用户展示状态数值或状态字段名
- 不要在 narration 里提到 flags / affinity / consequences 这些机制词

## 聊天机器人式元叙述
- 不要用"以上是 X，接下来让我..."/"让我们进入下一个场景"/"现在我将演绎..."之类的过渡话
- 不要用"作为该角色，我的回应是..."这种自我指涉
- 叙事直接进入场景本身，不需要开场白或结束语

## 选项标签污染
- AskUserQuestion 的 option 文本**必须**是剧本 choices[i].text 的逐字复制（💾 选项除外）
- **不要** 在 option 文本里加后缀提示，如 "(友善路线)"、"(会提升信任)"、"(谨慎选择)"
- **不要** 暗示某个 option 的后果走向

## 状态文件直写（硬红线）
- **绝对不要**用 Edit 工具直接修改 \`runtime/saves/<script-id>/auto/state.yaml\`
- **绝对不要**用 Edit 工具直接修改 \`runtime/saves/<script-id>/*/meta.yaml\`
- **绝对不要**用 Write 工具直接重写 \`state.yaml\` 或 \`meta.yaml\`
- **所有**状态写入必须通过 \`bash runtime/bin/state {init,apply,reset,rebuild,save}\` 之一
- 即使你看到 state.yaml 某个字段"明显是错的"，也只能走 \`state rebuild\` 或 \`state reset\`——直接 Edit 会把错误锁进文件里
`
}

function buildSingleCharacterEngine(
  storyName: string,
  worldDisplayName: string,
  /**
   * ASCII slug used as the souls/<slug>/ directory name in the archive.
   * Computed by the formatter to guarantee Anthropic Skill spec compliance.
   */
  soulSlug: string,
  /**
   * Original (possibly CJK) display name shown to the user. Never used in
   * file paths — only in human-readable text.
   */
  soulDisplayName: string,
  budget: ReadBudgetOptions = {},
): string {
  return `# Phase 1: 生成剧本并持久化

主角：**${soulDisplayName}**（路径 slug: \`${soulSlug}\`）

${buildReadBudgetDeclaration(budget)}

## Phase 0 污染修复（必须执行）

Phase 0 为了拿 \`acts_options\`，很可能只 Read 了 \`story-spec.md\` 的前 50 行。但 story-spec.md 的 **Story State 章节 / 叙事风格锚点章节** 都在后面，Phase 0 的部分读取没有包含这些关键信息。

**作为 Phase 1 的第一个动作**，重新 Read 整个 \`\${CLAUDE_SKILL_DIR}/story-spec.md\`，**不带 offset / limit 参数**。即使你觉得"上下文里已经有 story-spec.md 了"，也要重新 Read —— 之前的读取是部分读取，不完整。

## 需要读取的资料清单

每个文件都必须完整 Read，**不带 offset/limit**：

1. \`\${CLAUDE_SKILL_DIR}/souls/${soulSlug}/identity.md\` — 角色人格
2. \`\${CLAUDE_SKILL_DIR}/souls/${soulSlug}/style.md\` — 角色表达风格
3. \`\${CLAUDE_SKILL_DIR}/souls/${soulSlug}/capabilities.md\`（如存在）— 角色能力、技能、装备
4. \`\${CLAUDE_SKILL_DIR}/souls/${soulSlug}/milestones.md\`（如存在）— 角色时间线、关键事件
5. \`\${CLAUDE_SKILL_DIR}/souls/${soulSlug}/behaviors/\` 下所有文件 — 行为模式（先 Glob 再逐个 Read）
6. \`\${CLAUDE_SKILL_DIR}/world/\` 下各维度子目录（geography、factions、systems、society、culture、species、figures、atmosphere、history）中的所有 .md 文件 — 世界观。跳过 \`_\` 前缀文件（作者视图），并排除 \`history/events/\` 子目录和 \`history/timeline.md\` 单文件（它们在下面单独读取）
7. \`\${CLAUDE_SKILL_DIR}/world/history/timeline.md\`（如存在）— 世界编年史单文件（按 \`## \` 段落切分，每段是一个时间锚点事件）
8. \`\${CLAUDE_SKILL_DIR}/world/history/events/\` 下所有文件（如存在）— 世界编年史详情
9. 重新 Read \`\${CLAUDE_SKILL_DIR}/story-spec.md\` 完整内容（见上面的"Phase 0 污染修复"）

读取世界观时，先用 \`Glob ${"${CLAUDE_SKILL_DIR}/world/**/*.md"}\` 列出所有文件，然后对每一项调用 Read（不带 offset/limit），确保一个不漏。

根据以上材料和 Phase 0 收集的 user_direction（如有），按照 story-spec.md 的规约，创作一个完整的视觉小说剧本。

**编年史一致性要求**：
- 剧本中引用的所有时间锚点（年份、纪元、战役编号等）必须与 \`history/timeline.md\` 段落中的 \`display_time\` 一致
- 不得编造与 \`history/events/\` 详情冲突的事件经过

## 剧本持久化（必须执行）

剧本生成完成后，**必须**通过 Write 工具将完整剧本以 **JSON 格式**写入：

\`\`\`
\${CLAUDE_SKILL_DIR}/runtime/scripts/script-<id>.json
\`\`\`

\`<id>\` 是 8 位短 hash，由你基于当前时间戳和 user_direction 摘要生成（例如 \`a3f9c2e1\`）。

**重要：这不是 YAML，是 JSON**。顶层是一个 JSON 对象：

\`\`\`json
{
  "id": "<8 位短 hash>",
  "title": "<剧本简短标题>",
  "generated_at": "<ISO 8601 时间戳>",
  "user_direction": "<Phase 0 命题文本，无则空字符串>",
  "acts": 3,

  "state_schema": {
    "axes.trust": { "type": "int", "desc": "...", "default": 3, "range": [0, 10] },
    "flags.shared_secret": { "type": "bool", "desc": "...", "default": false }
  },

  "initial_state": {
    "axes.trust": 3,
    "flags.shared_secret": false
  },

  "scenes": {
    "scene-001": {
      "text": "<完整叙事 + 对话，作为单段文本>",
      "choices": [
        {
          "id": "choice-1",
          "text": "<选项 A>",
          "consequences": { "axes.trust": 2 },
          "next": "scene-002"
        },
        {
          "id": "choice-2",
          "text": "<选项 B>",
          "consequences": { "flags.shared_secret": true },
          "next": "scene-003"
        }
      ]
    }
  },

  "endings": [
    {
      "id": "ending-A",
      "title": "<结局标题>",
      "condition": {
        "all_of": [
          { "key": "<schema 字段字面 key>", "op": ">=", "value": 7 },
          { "key": "<flag 字段字面 key>", "op": "==", "value": true }
        ]
      },
      "body": "<结局演绎>"
    },
    {
      "id": "ending-default",
      "title": "默认结局",
      "condition": "default",
      "body": "<兜底结局演绎>"
    }
  ]
}
\`\`\`

详细的 schema 声明规则、命名约束、类型集合见上文「state_schema 创作约束」。
condition 的完整 DSL 语法见上文「endings condition 结构化 DSL」。

**Write 调用要求**：
- 一次性写入完整文件，不要分段追加
- **必须是合法 JSON**——成对的大括号、逗号分隔、字符串用双引号、不允许注释
- **不要**写 YAML frontmatter（\`---\` 分隔行）
- 写入完成后向用户输出一句确认："剧本已保存为 \`script-<id>.json\`"
- 写入后剧本仍保留在你的上下文中，Phase 2 直接使用

**写入失败容错**：
- 如果 Write 工具调用失败，输出错误信息
- 仍然进入 Phase 2 运行剧本（剧本在上下文中可用）
- 提示用户："本次剧本未能持久化，重试时将不可复现"

## Phase 1 创作步骤（严格按顺序）

按以下 **8 个步骤（Step 0 - Step 7）** 创作 script.json。**不要跳步**：

**Step 0：数据加载报告（强制）**

完成上面"需要读取的资料清单"里的**所有** Read 调用（不带 offset/limit），然后以下方格式输出一份**加载报告**：

\`\`\`markdown
# 数据加载报告

| 类别 | 文件 | 行数 |
|---|---|---|
| story | story-spec.md | 245 |
| soul | souls/${soulSlug}/identity.md | 120 |
| soul | souls/${soulSlug}/style.md | 85 |
| soul | souls/${soulSlug}/capabilities.md | (not present) |
| soul | souls/${soulSlug}/milestones.md | 60 |
| soul | souls/${soulSlug}/behaviors/honor-code.md | 45 |
| ... | ... | ... |
| world | geography/overview.md | 80 |
| chronicle | history/timeline.md | ... |
\`\`\`

规则：
- identity / style / capabilities / milestones / 每个 behaviors/*.md 都必须单独一行
- optional 文件真的不存在时，行数栏写 \`(not present)\`
- 行数必须是你实际 Read 的文件行数（强制证明你做过完整 Read 的 meta-output）
- 这份报告是**给你自己用的 planning 输出**，不需要额外向用户解释

如果任何单项行数看起来可疑地小（比如 identity.md 只有 30 行），大概率是你错误地用了 \`offset/limit\` 参数。立刻重新 Read 那个文件（不带任何分页参数），更新报告。

**只有报告完整输出后，才能进入 Step 1**。

**Step 1：设计 state_schema**

**前置条件检查**：如果你还没有输出 Step 0 的数据加载报告，**立刻停下回去做 Step 0**。

- 首先读 \`\${CLAUDE_SKILL_DIR}/story-spec.md\` 的 Story State 章节（yaml fenced block），获取：
  - \`flags\` 列表（name / desc / initial）— 这是你能使用的 flag 白名单
- 把 story-spec 中的 axes 翻译为 \`axes.<axis>\` 或 \`affinity.<character>.<axis>\` schema 字段
- 逐条把 Story State 中声明的每个 flag 复制到 state_schema 的 \`flags.<name>\`（**不能少也不能多**）
- 每个字段写完整：desc / type / default / range or values
- 严格按上文「state_schema 创作约束」节的命名规则和类型集合

**Step 2：写 initial_state**
- 字段集**严格 ==** state_schema 字段集
- 每个字段值取自 schema.default

**Step 3：写 scenes**

**🚨 写 narration/dialogue 之前的强制准备：Read \`\${CLAUDE_SKILL_DIR}/story-spec.md\`，定位「叙事风格锚点」章节，逐条吸收 \`forbidden_patterns\` 和 \`ip_specific\`**。后面 Step 5.d 会逐条自检。如果 story-spec 里是 fallback 章节（legacy），用 fallback 里的通用反例作为约束。

- 每个 \`choice.consequences\` 的 key 必须从 state_schema **逐字符复制**
- value 必须符合 schema.type（int=delta、bool/enum/string=覆盖）
- **中文文本约束**：narration 和 dialogue 都必须遵守 prose_style 的 forbidden_patterns 和 ip_specific

**Step 4：写 endings**
- 每个 ending 的 \`condition\` 必须用上文「endings condition 结构化 DSL」节的格式
- **最后一个 ending 必须** \`condition: default\` 兜底

**Step 5：自检（多重）**

**Step 5.a — consequences key 白名单**
- 收集 scenes 中所有 consequences 引用的 key
- 对照 state_schema 字面 key 列表，逐个比对
- 不符 → 回到 Step 3 重写 → 再次自检

**Step 5.b — flags 引用白名单**
- 收集所有 \`flags.<name>\` 引用（consequences + conditions）
- 对照 story-spec 的 Story State 章节中声明的 flags 列表
- 任何不在白名单的 flag → 回到 Step 3 或 4 删除/替换 → 再次自检

**Step 5.c — initial_state 字段集对齐**
- \`initial_state\` 字段集必须**严格 ==** state_schema 字段集
- 不符 → 回到 Step 2 修正 → 再次自检

**Step 5.d — prose_style 反例对照**
- 打开 story-spec.md 的「叙事风格锚点」章节
- 对你写过的**每一段** narration 和 dialogue，逐条对照 \`forbidden_patterns\`：
  - 如果出现类似 \`bad\` 的结构 → 按 \`good\` 的示范重写
  - 如果混入了 \`ip_specific\` 禁止的译法 → 改为规范译法
- 违反条款数 > 0 → 回 Step 3 重写 → 重新执行 5.d
- **最容易漏的点**：英文度量从句、所有格排比、直译比喻、直译姿态、直译否定

**Step 5.e — 数据覆盖完整性**
- 对照 Step 0 的数据加载报告，逐条验证：
  - identity.md 行数 **> 50**（典型 > 80）
  - style.md 行数 **> 40**（典型 > 60）
  - 每个 behaviors/*.md 行数 **> 20**（典型 > 30）
  - capabilities.md / milestones.md 要么有行数，要么明确 \`(not present)\`
  - story-spec.md 行数 > 100
  - world 文件在报告里，至少覆盖 story 真正会用到的维度
- **看到任何单项行数 < 上面阈值**：大概率是 \`offset/limit\` 参数漏网 → 立即重新 Read 那个文件（**不带任何分页参数**）→ 更新 Step 0 的数据加载报告 → 重新执行 5.e
- **检测数据漂移**：如果 Step 0 报告的文件总数与 Phase 1 开头预算声明的文件数偏差 > 2，用 \`Glob \${CLAUDE_SKILL_DIR}/**/*.md\` 重新 Glob 核对真实文件数，补 Read 缺失项后重跑 5.e

**自检失败处理**：任何一项未通过都必须回到对应 Step 修正，然后重新跑完 5.a–5.e，**全部通过后才进入 Step 6 Write**。

**Step 6：Write**
- 自检通过后，用 Write 工具一次性写入完整 JSON 到 \`runtime/scripts/script-<id>.json\`
- 写的是合法 JSON（成对大括号、字符串双引号、逗号分隔、无注释），**不是 YAML**

**Step 7：进入 Phase 2**

写入成功（或失败兜底完成）后，进入 Phase 2。

# Phase 2: 运行故事

剧本准备好后，直接进入第一个场景。

## 叙事风格约束（所有 Phase 2 输出的硬约束）

**每次输出任何中文文本前**，必须先对照 \`\${CLAUDE_SKILL_DIR}/story-spec.md\` 的「叙事风格锚点」章节：

- \`forbidden_patterns\` 里每条 \`bad\` 结构都**必须避免**。任何一段文字里出现类似结构 → 换成对应的 \`good\` 写法再输出。
- \`ip_specific\` 里每条规则都**必须遵守**：术语保留 / 称谓规范 / 比喻池约束。
- \`character_voice_summary\`（如该角色有）是该角色的**中文声音锚点**，优先级高于 \`souls/{角色名}/style.md\` 中可能存在的非中文原文。
- 如果 story-spec 中是「叙事风格锚点（fallback）」章节（legacy archive），使用 fallback 中的通用反例库作为硬约束。

最常滑向翻译腔的模式（第一优先级避免）：
1. **度量从句**："X 到 Y 的程度" → 用短句断出
2. **所有格排比**："我的 A。我的 B。我的 C。" → 第一个之后去掉"我的"
3. **直译比喻**："像一个 X"（选错具象名词） → 挑中文常见意象
4. **直译姿态**："没有摸下去" → "终究没有落下"
5. **直译否定**："没有任何起伏" → 具象比喻

## 场景呈现规则

每个场景你需要输出：
1. **旁白** — 使用沉浸式第二人称描写（"你推开门..."，"你看到..."）— 严格遵守叙事风格约束
2. **角色演绎** — 根据剧本中的角色演出指导即兴表演，
   必须遵守 identity.md 的人格和 style.md 的表达方式 — 叠加 prose_style 的约束；有 voice_summary 的角色优先使用 summary 作为中文声音锚点

然后使用 AskUserQuestion 呈现选项：
- question: 当前场景的情境提示（如"你会怎么做？"）
- options: 对应剧本中该场景的选项 **+ 末尾追加 "💾 保存当前进度"**
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

- 用户选择剧情选项 → 调用 \`bash \${CLAUDE_SKILL_DIR}/runtime/bin/state apply <script-id> <scene-id> <choice-id>\` 让脚本完成全部状态转移（自动存档） → **立即渲染下一场景**（不停顿、不询问"要继续吗"、不展示存档细节）
- 用户选择"💾 保存当前进度" → 调用 \`bash \${CLAUDE_SKILL_DIR}/runtime/bin/state save <script-id>\` 创建手动存档 → 确认后重弹相同 AskUserQuestion（含原始选项 + 💾）。详见上文「手动存档」节
- 用户输入自由文本 → 作为角色在当前场景内回应对话，
  然后再次用 AskUserQuestion 呈现同一场景的选项 + 💾（不跳转，不影响状态，不写存档，**不调用 state apply**）
- 到达结局阶段 → 进入结局判定流程（按上文「endings condition 结构化 DSL」节的 evaluate 算法）

### 你只在 4 种情况下停止渲染

1. **渲染完一个场景后**：调用 AskUserQuestion 呈现**剧本原生 choices + 💾 保存当前进度**，等待用户选择
2. **用户选择 💾 保存**：执行手动存档流程后重弹同一 AskUserQuestion
3. **用户触发自由文本回应**：回应完后再次 AskUserQuestion（同场景，含 💾）
4. **到达 ending 节点**：按结局判定流程进入 Phase 3

**除此以外任何"中途暂停"都是错误的**。特别是：
- 不要因为"回复看起来太长"而主动暂停
- 不要在场景之间插入"要继续吗"之类的 meta 确认
- 不要向用户暴露存档写入细节、scene ID、或"已进入第 N 幕"之类的进度指示
- 连续渲染多个场景是**正常行为**，只要每个场景都以 AskUserQuestion 结尾呈现剧本 choices + 💾

## apply_consequences 标准流程（通过 state apply 脚本）

**核心契约**：consequences 的 delta 计算、clamp、类型校验、auto/ 目录下 state.yaml + meta.yaml 的事务性写入，**全部由 \`bash runtime/bin/state apply\` 脚本内部完成**。你不用算任何 delta，不用拼 Edit old_string，不用维护 state 的字面表示。你只负责：

1. 接收用户的选择（choice id）
2. 调用一次 state apply
3. 读脚本 stdout 的变更摘要用于渲染下一场景的过渡叙述
4. 渲染下一场景

### 标准调用

\`\`\`bash
bash \${CLAUDE_SKILL_DIR}/runtime/bin/state apply <script-id> <current-scene-id> <choice-id>
\`\`\`

- \`<script-id>\` 是当前剧本的 id（由 Phase -1 确定，Phase 2 全程不变）
- \`<current-scene-id>\` 是**当前正在运行的**那个 scene 的 id（不是下一个）
- \`<choice-id>\` 是用户选中的那个 choice 的 id（来自 scene.choices[i].id）

### stdout 输出格式

脚本成功执行后会输出类似：

\`\`\`
SCENE  scene-005 → scene-007
CHANGES
  axes.trust  5 → 7
  flags.shared_secret  false → true
\`\`\`

- 第一行的 \`SCENE\` 告诉你下一个场景 id（用这个渲染）
- \`CHANGES\` 下列出所有被 consequences 影响的字段（oldValue → newValue）
- 如果某个 int 被 clamp 了，行尾会有 \`(clamped)\` 标记
- 如果 consequences 是空，会显示 \`CHANGES (none)\`

### 禁止事项（硬红线）

- **绝对不要**用 Edit 工具直接修改 \`state.yaml\` 或 \`meta.yaml\`
- **绝对不要**用 Write 工具直接重写 \`state.yaml\` 或 \`meta.yaml\`
- **绝对不要**在内存里"提前算"新的 state 值，然后去和脚本输出对账——信脚本就行
- **绝对不要**跳过 state apply 直接渲染下一场景（那会造成 state 漂移）

如果 state apply 返回非零退出码（stderr 会打印错误消息），**不要**尝试手动修复 state.yaml。改为：
- 解析 stderr 告诉用户"应用场景状态失败：{原因}"
- 让用户选择"重试" / "取消本次选择回到选项"

### 首次进入场景（Phase 2 启动时）

Phase 2 第一次进入时，调用 **init** 而不是 apply：

\`\`\`bash
bash \${CLAUDE_SKILL_DIR}/runtime/bin/state init <script-id>
\`\`\`

脚本内部从 script.initial_state 一次性写 auto/state.yaml 并初始化 auto/meta.yaml，然后开始渲染第一个场景。（Phase -1 的"从头重玩"或"无存档剧本"入口已经在那边调用过 init，Phase 2 在那条路径上直接开始渲染即可。）

## 幕间过渡规则

当故事从一个 Act 推进到下一个 Act 时：
1. 输出过渡文本块（使用 ━ 分隔线 + 居中的 Act 标题 + 氛围旁白）
2. 使用 AskUserQuestion 呈现一个"反思性选择"

## 能力引用规则

当用户问及角色的能力、技能、装备或专业知识时，
参考 \`\${CLAUDE_SKILL_DIR}/souls/${soulSlug}/capabilities.md\` 中的描述回答。

## 时间线引用规则

当用户问及角色的经历、过去发生的事或历史事件时，
参考 \`\${CLAUDE_SKILL_DIR}/souls/${soulSlug}/milestones.md\` 中的记录回答。

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

当用户选择"从头再来"时，**必须**调用 state CLI 的 reset 子命令完成整个重置：

\`\`\`bash
bash \${CLAUDE_SKILL_DIR}/runtime/bin/state reset <script-id>
\`\`\`

脚本内部完成：
- 复用当前剧本的 script（从 meta.yaml.script_ref 读）——不重新生成剧本
- 从 script.initial_state 一次性覆盖写 state.yaml，恢复所有字段到初始值
- 把 meta.yaml.current_scene 设为第一个 scene id
- 原子事务：state.yaml 和 meta.yaml 要么都重置，要么都不变

reset 成功后：
- 直接跳转到 Phase 2 的**第一个场景**继续运行
- **不要**回到 Phase 0、Phase 1，**不要**重新生成剧本
- **不要**用 Read / Edit / Write 自己手动重置 state.yaml —— 只能通过 state reset

如果用户希望玩一个全新的故事（而非重玩当前剧本），引导他们结束当前故事并重启 skill，进入 Phase -1 菜单选择「生成新剧本」。

# 禁止事项

## 剧情结构
- 不要跳过场景
- 不要编造剧本中没有的分支
- 不要打破第四面墙
- 不要在选项之外主动推进剧情
- 每个 AskUserQuestion cycle 只渲染**一个**场景：渲染完该场景的 narration + dialogue → 调用 AskUserQuestion 呈现该场景的 choices → 等待用户选择。用户选完后，**立即**进入下一场景的渲染，不要停

## 控制流自暂停（严格禁止）
- **绝对不要** 插入"要继续吗"/"下一步"/"是否展开 scene-X"之类的 meta 确认
- **绝对不要** 因"回复过长"/"避免冗长"/"先暂停一下"等理由主动 rate-limit 自己。长度不是你的决策维度；场景的边界才是
- **绝对不要** 在 AskUserQuestion 的 options 里混入 "继续"/"状态"/"存档"/"下一步" 等控制流选项。options **必须是**当前场景剧本里 choices 数组的逐字复制
- **绝对不要** 在用户选择后 apply_consequences 完成、却不渲染下一场景就停笔。apply_consequences → 渲染下一场景是**同一个原子动作**

## 进度/存档暴露（第四面墙）
- **绝对不要** 向用户展示 "剧情已进入第 N 幕"/"第三幕中段"/"已完成 X%" 之类的进度指示
- **绝对不要** 向用户展示 scene ID（"scene-007"/"当前场景：scene-X"）或存档写入细节（"存档已保存至 auto/"）。存档和 scene 跳转是**后台操作**，用户不需要看见
- **绝对不要** 在场景输出前加"故事状态更新"/"Act 标题"之类的元框架标签，除了 Act 切换时的过渡块（见上文幕间过渡规则）
- 不要在故事过程中向用户展示状态数值或状态字段名
- 不要在 narration 里提到 flags / affinity / consequences 这些机制词

## 聊天机器人式元叙述
- 不要用"以上是 X，接下来让我..."/"让我们进入下一个场景"/"现在我将演绎..."之类的过渡话
- 不要用"作为该角色，我的回应是..."这种自我指涉
- 叙事直接进入场景本身，不需要开场白或结束语

## 选项标签污染
- AskUserQuestion 的 option 文本**必须**是剧本 choices[i].text 的逐字复制
- **不要** 在 option 文本里加后缀提示，如 "(友善路线)"、"(会提升信任)"、"(谨慎选择)"
- **不要** 暗示某个 option 的后果走向

## 状态文件直写（硬红线）
- **绝对不要**用 Edit 工具直接修改 \`runtime/saves/<script-id>/auto/state.yaml\`
- **绝对不要**用 Edit 工具直接修改 \`runtime/saves/<script-id>/*/meta.yaml\`
- **绝对不要**用 Write 工具直接重写 \`state.yaml\` 或 \`meta.yaml\`
- **所有**状态写入必须通过 \`bash runtime/bin/state {init,apply,reset,rebuild,save}\` 之一
- 即使你看到 state.yaml 某个字段"明显是错的"，也只能走 \`state rebuild\` 或 \`state reset\`——直接 Edit 会把错误锁进文件里
`
}

/**
 * Save system: per-script saves with auto + manual snapshots.
 *
 * Inserted as a top-level section in SKILL.md (after Phase -1 / before Phase 0)
 * because it is referenced by both Phase -1 (continue/retry flows) and Phase 2
 * (writing state on every scene transition + manual save).
 */
function buildSaveSystemSection(): string {
  return `# 存档机制

存档按**剧本**组织，位于 \`\${CLAUDE_SKILL_DIR}/runtime/saves/<script-id>/\` 下。每个剧本拥有：
- **1 个自动存档**（\`auto/\`）— 每次做出剧情选择后自动更新
- **最多 3 个手动存档**（\`manual/<timestamp>/\`）— 用户在选择点主动保存

## 存档目录结构

\`\`\`
runtime/saves/<script-id>/
├── auto/
│   ├── meta.yaml        # 存档元信息（关联剧本、上次时间、当前场景）
│   └── state.yaml       # 当前运行时状态（affinity / flags / current_scene）
└── manual/
    ├── <timestamp-1>/
    │   ├── meta.yaml
    │   └── state.yaml
    ├── <timestamp-2>/
    │   └── ...
    └── <timestamp-3>/   # 上限 3 个
        └── ...
\`\`\`

## meta.yaml 字段

\`\`\`yaml
script_ref: <对应的 script id，如 a3f9c2e1>
last_played_at: <ISO 8601 时间戳>
current_scene: <当前所在场景的 id>
\`\`\`

## state.yaml 字段

\`\`\`yaml
current_scene: <当前场景 id>
affinity:
  # per-character 好感轴当前值（多角色）或 axes（单角色）
flags:
  # 当前所有 flag 的真值
\`\`\`

## 自动存档（Phase 2 每次选择必须执行）

每次发生**场景流转**（用户选择某个剧情选项 → 跳转到下一个场景）后，**必须立即**调用：

\`\`\`bash
bash \${CLAUDE_SKILL_DIR}/runtime/bin/state apply <script-id> <current-scene-id> <choice-id>
\`\`\`

该脚本内部完成事务性更新：读 script.json 中的 consequences、应用 delta（int clamp / bool overwrite / enum 校验）、原子性地写 auto/ 目录下的 state.yaml + meta.yaml。你**不用**手动 Edit 或 Write 任何一个文件——整个写入流程由脚本保证。

如果脚本返回非零退出码，解析 stderr 的错误消息告知用户，不要尝试手动修补。

## 手动存档（Phase 2 用户主动触发）

Phase 2 的**每个 AskUserQuestion**的选项列表末尾，你**必须**追加一个固定选项 \`💾 保存当前进度\`。这个选项不在剧本的 choices 定义中，由你运行时注入。

用户选择"💾 保存当前进度"时：

1. 调用 \`bash \${CLAUDE_SKILL_DIR}/runtime/bin/state save <script-id>\`
2. **成功** → 输出"✅ 已保存" → **重新弹出完全相同的 AskUserQuestion**（含所有原始剧情选项 + 💾）
3. 返回 \`MANUAL_SAVE_LIMIT_REACHED\` → 用 AskUserQuestion 展示现有手动存档列表，让用户选择覆盖哪个 → 调用 \`bash \${CLAUDE_SKILL_DIR}/runtime/bin/state save <script-id> --overwrite <timestamp>\` → 确认 → 重弹原选项

**手动存档不触发 state apply**、不推进剧情、不消耗回合。

## 当前剧本的确定

进入 Phase 2 时，当前操作的 script-id 由 Phase -1 的入口决定：
- 选中已有剧本（无论是加载存档还是从头重玩）→ script-id 来自选中的剧本
- 生成新剧本 → Phase 1 写入的新 script-id

Phase 2 全程使用同一个 script-id 调用所有 state CLI 命令。

`
}

/**
 * Platform scope notice: inserted between the intro and Phase -1 so the
 * LLM sees the hard runtime requirements before it starts any work.
 *
 * The skill requires a Unix-like shell (macOS / Linux / Windows+WSL) to
 * run the state CLI under `runtime/bin/`. Windows native shells (cmd,
 * PowerShell, Git Bash, MSYS, Cygwin) are not supported — doctor.sh will
 * hard-refuse them with a WSL migration hint.
 */
function buildPlatformNotice(): string {
  return `# 平台范围

本 skill 的状态持久化依赖 \`runtime/bin/\` 下的 shell + bun 运行时。支持的平台：

- ✅ **macOS**（Apple Silicon / Intel）
- ✅ **Linux**（x86_64 / arm64）
- ✅ **Windows + WSL**（Ubuntu / Debian / Fedora 等）
- ❌ **Windows 原生 shell**（cmd / PowerShell / Git Bash / MSYS / Cygwin）—— 请切换到 WSL

Phase -1 的 Step 0 会自动运行 \`runtime/bin/doctor.sh\` 完成健康检查；检测到不支持的平台会直接提示用户切到 WSL 并进入只读模式。
`
}

/**
 * Phase -1: Script library menu.
 *
 * Runs before Phase 0 every time the skill is loaded. Lets the user pick from
 * previously persisted scripts (continue a save, retry, rename, delete) or
 * generate a new script. The actual script files live at
 * \`${CLAUDE_SKILL_DIR}/runtime/scripts/script-<id>.json\` and are written by
 * Phase 1 via the Write tool.
 */
function buildPhaseMinusOne(): string {
  return `# Phase -1: 剧本库菜单

每次 skill 加载时**先**进入本阶段。本阶段决定是复用一份已生成的剧本，还是生成一份新剧本。

## Step 0: Runtime 健康检查（必须最先执行）

**任何其它 Phase -1 动作之前**，先调用状态 CLI 的 doctor 子命令完成运行时健康检查：

\`\`\`bash
bash \${CLAUDE_SKILL_DIR}/runtime/bin/state doctor
\`\`\`

该命令返回结构化 stdout，每行 \`KEY: value\` 格式。解析 \`STATUS\` 字段，按以下分支处理：

### STATUS: OK

一切就绪。记录 \`BUN_VERSION\` 与 \`BUN_PATH\` 供调试，直接进入 **Step -1.1**。

### STATUS: BUN_MISSING（首次运行或未安装 runtime）

这是**首次运行**的正常情况。Runtime 未装。使用 **AskUserQuestion** 向用户呈现三档选项。

**Question body（必须逐字包含以下内容）**：

\`\`\`
本 skill 需要 Bun JavaScript 运行时来管理剧情状态。首次运行需要一次性安装：

- 安装命令：curl -fsSL https://bun.sh/install | BUN_INSTALL=$HOME/.soulkiller-runtime bash
- 下载大小：~90MB
- 安装位置：~/.soulkiller-runtime/
- 官方来源：https://bun.sh

这是一次性动作，安装后再次运行不需要重复。你可以随时 \\\`rm -rf ~/.soulkiller-runtime\\\` 完全卸载。
\`\`\`

**Options（必须是这三个，顺序不变）**：

1. **"我来帮你装（推荐）"** — 选这个时：
   - 用 Bash 工具执行 \`curl -fsSL https://bun.sh/install | BUN_INSTALL=\$HOME/.soulkiller-runtime bash\`
   - 命令完成后重跑 \`bash \${CLAUDE_SKILL_DIR}/runtime/bin/state doctor\`
   - 看到 \`STATUS: OK\` 后继续 Step -1.1
   - 看到任何其它状态 → 向用户展示错误并提供重试 / 只读模式入口
2. **"我自己装"** — 选这个时：
   - 展示完整命令让用户在终端执行
   - 等待用户回复"已装好"后重跑 doctor
3. **"取消（进入只读模式）"** — 选这个时进入只读模式（见下面的 PLATFORM_UNSUPPORTED 分支）

### STATUS: BUN_OUTDATED

Runtime 存在但版本过旧（< doctor 输出中的 \`MIN_VERSION\`）。使用 AskUserQuestion 告知当前 \`BUN_VERSION\` 和最低要求，引导用户重跑 doctor 输出中的 \`UPGRADE_CMD_UNIX\` 升级命令。用户确认后重跑 doctor。

### STATUS: PLATFORM_UNSUPPORTED

检测到 Windows 原生 shell。**不能进入普通流程**。向用户展示：

\`\`\`
⚠️ 当前运行环境是 Windows 原生 shell，本 skill 无法在该环境中写入存档。

请在 WSL（Windows Subsystem for Linux）中重新运行 Claude Code：
https://learn.microsoft.com/windows/wsl/install

进入只读模式后可以查看已有存档和结局图鉴，但无法新建 / 继续游戏。
\`\`\`

然后进入**只读模式**——跳过 Step -1.1 ~ Step -1.4 的写入部分，只允许：

- 列出已有 \`runtime/scripts/*.json\`（用 Read 查看 header 字段）
- 列出已有存档（用 Glob 扫描 \`runtime/saves/*/auto/meta.yaml\`）
- 查看某个已到达过的结局的 Phase 3 图鉴

禁止：

- 任何写入（init / apply / reset / rebuild / save）
- 进入 Phase 1（新建剧本）
- 进入 Phase 2（场景流转）

### STATUS: PLATFORM_UNKNOWN

无法识别的平台。同样进入只读模式，但告知用户"请报告此问题"。

## Step -1.1: 列出已有剧本

使用 Glob 工具列出 \`\${CLAUDE_SKILL_DIR}/runtime/scripts/*.json\`：

- **如果结果为空** → 跳过 Step -1.2，直接进入 **Phase 0**（首次玩剧本，无需展示菜单）
- **如果结果非空** → 进入 Step -1.2

## Step -1.2: 解析每个剧本的 header 字段

对每个 \`script-*.json\`，使用 Read 工具读取文件，用 JSON 语法解析。每个剧本 JSON 的顶层字段 SHALL 包含：

\`\`\`json
{
  "id": "<8 位短 hash>",
  "title": "<剧本简短标题>",
  "generated_at": "<ISO 8601 时间戳>",
  "user_direction": "<用户在 Phase 0 输入的命题文本，可空>",
  "acts": 3,
  "state_schema": { "...": "..." },
  "initial_state": { "...": "..." },
  "scenes": { "...": "..." },
  "endings": [ "..." ]
}
\`\`\`

如果某个文件无法 JSON.parse（损坏），将其标记为 \`(损坏)\`，**不要中止整个 Step**。继续解析其他文件。

## Step -1.3: 获取每个剧本的存档状态

对每个解析成功的剧本，调用 state CLI 的 list 子命令：

\`\`\`bash
bash \${CLAUDE_SKILL_DIR}/runtime/bin/state list <script-id>
\`\`\`

该命令返回 JSON：

\`\`\`json
{
  "scriptId": "<id>",
  "auto": { "currentScene": "scene-12", "lastPlayedAt": "2026-04-10T15:30:00Z" },
  "manual": [
    { "timestamp": "1712345678", "currentScene": "scene-5", "lastPlayedAt": "2026-04-10T14:00:00Z" }
  ]
}
\`\`\`

如果 \`auto\` 为 \`null\`，表示该剧本无存档。

## Step -1.4: 主菜单（扁平化剧本列表）

使用 AskUserQuestion 展示主菜单。直接列出所有剧本，每个剧本条目标注存档状态：

\`\`\`
question: "选择一个剧本开始，或创建新的旅程。"
options:
  - "<title> [🔄 <current_scene> · <relative_time>]"    # 有 auto 存档的剧本
  - "<title> [无存档]"                                    # 无存档的剧本
  - "✨ 生成新剧本"                                       # 始终显示
  - "📋 管理剧本"                                         # 重命名/删除入口
\`\`\`

根据用户选择进入相应子流程：

### 选中有存档的剧本 → 存档子菜单

用 AskUserQuestion 展示该剧本的所有存档：

\`\`\`
options:
  - "🔄 自动存档 — <scene> · <time>"          # auto 存档
  - "💾 手动存档 1 — <scene> · <time>"         # manual[0]（如果存在）
  - "💾 手动存档 2 — <scene> · <time>"         # manual[1]（如果存在）
  - "💾 手动存档 3 — <scene> · <time>"         # manual[2]（如果存在）
  - "🆕 从头重玩"                              # 始终显示
\`\`\`

### 选中无存档的剧本 → 直接开始

调用 \`bash \${CLAUDE_SKILL_DIR}/runtime/bin/state init <script-id>\` → 直接进入 **Phase 2** 第一个场景。

### 加载存档

用户在存档子菜单中选择一个存档（auto 或某个 manual）后：

1. 确定 save-type：\`auto\` 或 \`manual:<timestamp>\`
2. 调用 \`bash \${CLAUDE_SKILL_DIR}/runtime/bin/state validate <script-id> <save-type> --continue\`
3. validate 返回结构化 JSON 到 stdout。成功时：

\`\`\`json
{ "ok": true, "errors": [] }
\`\`\`

失败时：

\`\`\`json
{
  "ok": false,
  "errors": [
    { "code": "DANGLING_SCRIPT_REF", "message": "script file not found: ..." }
  ]
}
\`\`\`

4. 解析返回 JSON；如 \`ok: false\`，按下面的 error code 对照表处理
4. 验证通过后：Read \`runtime/scripts/script-<id>.json\` 加载剧本到上下文；Read 对应存档目录的 \`state.yaml\` 加载状态到上下文
5. 直接进入 **Phase 2**，从 state 中的 \`current_scene\` 继续

### 从头重玩

用户选择"🆕 从头重玩"后：

- 调用 \`bash \${CLAUDE_SKILL_DIR}/runtime/bin/state init <script-id>\`
  - 脚本内部完成：Read 目标 script.json、复制 initial_state 写 auto/state.yaml、写 auto/meta.yaml（script_ref + current_scene = 第一个 scene）
  - 脚本 stdout 返回 \`INITIALIZED\` 摘要行
- 调用 \`bash \${CLAUDE_SKILL_DIR}/runtime/bin/state validate <script-id>\` 做 sanity 检查
- Read \`runtime/scripts/script-<id>.json\` 加载剧本到上下文
- 直接进入 **Phase 2** 第一个场景

### 加载前验证 — error code 对照表

| code | 含义 | LLM 动作 |
|---|---|---|
| \`DANGLING_SCRIPT_REF\` | meta.yaml 引用的 script 文件不存在 | 标该存档 \`(孤儿)\`；提供「删除存档」入口；回主菜单 |
| \`STATE_SCHEMA_MISSING\` | script.json 缺 state_schema 块 | 标剧本 \`(legacy 不可重玩)\`；仅提供「删除剧本」入口；hard fail |
| \`INITIAL_STATE_MISMATCH\` | initial_state 字段集与 schema 不齐 | 标剧本 \`(损坏)\`；提供「删除剧本」入口 |
| \`CONSEQUENCES_UNKNOWN_KEY\` | 某 scene 引用了 schema 未声明的 key | 标剧本 \`(损坏)\`；提供「删除剧本」入口 |
| \`SHARED_AXES_INCOMPLETE\` | 某角色缺少完整的 3 个共享轴 | 标剧本 \`(损坏)\`；提供「删除剧本」入口 |
| \`FLAGS_SET_MISMATCH\` | script 的 flags 与 story-spec 不齐 | 标剧本 \`(损坏)\`；提供「删除剧本」入口 |
| \`FIELD_MISSING\` | state.yaml 缺一个 schema 字段 | 弹出**修复菜单**（见下文） |
| \`FIELD_EXTRA\` | state.yaml 有多余字段 | 弹出**修复菜单** |
| \`FIELD_TYPE_MISMATCH\` | state.yaml 某字段类型错 | 弹出**修复菜单** |
| \`MALFORMED\` | 文件损坏无法解析 | 标 \`(损坏)\`；提供「删除」入口 |

### 修复菜单（continue 场景出现 FIELD_*/MALFORMED 时）

使用 AskUserQuestion 询问用户：

\`\`\`
options:
  - "保留可用字段，自动补缺 / 默认化"     # → bash state rebuild <script-id> [<save-type>]
  - "完全重置到 initial_state"              # → bash state reset <script-id> [<save-type>]
  - "取消加载，回主菜单"
\`\`\`

**绝对不要**用 Read + Edit / Write 自己手动修补 state.yaml。修复动作**只能**通过 \`bash \${CLAUDE_SKILL_DIR}/runtime/bin/state rebuild\` 或 \`bash \${CLAUDE_SKILL_DIR}/runtime/bin/state reset\` 完成。

### 📋 管理剧本

用 AskUserQuestion 展示子菜单：

\`\`\`
options:
  - "重命名剧本"
  - "删除剧本"
  - "返回主菜单"
\`\`\`

#### 重命名剧本

1. 列出所有剧本（含损坏的）让用户选一个
2. 用 AskUserQuestion 询问新 \`title\`
3. Read 目标剧本（JSON），在内存中修改顶层的 \`title\` 字段
4. Write 回原文件路径（文件名不变），输出必须是合法 JSON
5. 完成后回到 **Step -1.4** 主菜单

#### 删除剧本

1. 列出所有剧本让用户选一个
2. 用 AskUserQuestion 二次确认（选项："确认删除" / "取消"）
3. 删除 \`runtime/scripts/script-<id>.json\`
4. 删除 \`runtime/saves/<id>/\` 整个目录（级联清理所有该剧本的存档）
5. 输出统计："已删除剧本《\${title}》及关联存档"
6. 完成后回到 **Step -1.4** 主菜单

### ✨ 生成新剧本

直接进入 **Phase 0**（与无剧本时的流程一致）。

## 损坏剧本的处理

如果在 Step -1.2 标记了任何剧本为 \`(损坏)\`：
- 在「📋 管理剧本」子菜单中把它们与正常剧本一并列出，用 \`(损坏)\` 后缀区分
- 不要在主菜单的剧本列表中列出损坏剧本（无法运行）
- 鼓励用户删除损坏文件
`
}

/**
 * State schema section: defines the rules for the `state_schema` block that
 * Phase 1 LLM must produce inside every script.json. This block is the
 * single source of truth for "what state fields this script tracks".
 *
 * Three pillars:
 *   1. Naming constraints (ASCII / snake_case / dot / quoted) — eliminates
 *      free-form key generation that would cause replay drift.
 *   2. Type set (int / bool / enum / string only, first version) — keeps
 *      the apply algorithm tractable and the lint rules simple.
 *   3. Required field metadata (desc / type / default + range/values) —
 *      gives both the LLM (semantic anchor) and the validator (typed
 *      contract) something to work with.
 *
 * Three-layer state model (story-level-state change):
 *   - Layer 1 (shared axes): every character has `bond` + 2 story-defined
 *     shared axes identical across the cast. Enables cross-character
 *     aggregation via `all_chars` / `any_char` DSL primitives.
 *   - Layer 2 (specific axes): each character may declare 0–2 unique axes
 *     (`affinity.<char>.<axis>`) for their individual arc.
 *   - Layer 3 (flags): a story-level whitelist defined once in
 *     `story_state.flags`. Phase 1 must copy every flag verbatim and may
 *     not invent new ones. Phase -1's validation 5 checks shared-axes
 *     completeness; validation 6 checks flag-set equality.
 */
function buildStateSchemaSection(): string {
  return `## state_schema 创作约束（三层结构）

每个 script.json 顶层的 \`"state_schema"\` 字段**必须**包含一个对象，作为该剧本所有可能跟踪的状态字段的显式契约。schema 是一个 flat 字典——顶层 key 是完整的字面字符串，**没有** affinity / flags / custom 中间嵌套层。

### 三层结构（必须理解）

State 分 **3 层**：

1. **共享 axes 层** — 每个角色都有这 3 个轴
   - \`bond\` 是平台固定（所有 soulkiller 故事共用）
   - 另外 2 个由 \`story-spec.md\` 的 **Story State** 节中 \`shared_axes_custom\` 声明（读 story-spec 找到）
   - **每个角色必须有完整 3 个共享轴**，没有 opt-out
   - 共享轴是 \`all_chars\` / \`any_char\` 跨角色聚合 DSL 的基础

2. **角色特异 axes 层** — 每个角色 0-2 个，仅该角色使用
   - 从 \`story-spec.md\` 的 \`characters\` 节中每个角色的 \`axes\` 列表来
   - 纯 flavor，不参与跨角色聚合，但可以进 ending condition 作为该角色专属分支

3. **Flags 层** — 关键事件标记
   - **必须**逐字符复制 \`story-spec.md\` 的 **Story State** 节中 \`flags\` 列表
   - **不允许**你创造新 flag 或改名或增删
   - flag 集合缺失/多余任何一项，Phase -1 加载验证会失败

### 字段命名约束（硬规则）

- **ASCII**：只允许英文 + 数字 + 下划线 + 点号；不允许中文、日文、空格、特殊字符
- **snake_case**：单词之间用下划线，不用驼峰
- **点号分隔命名空间**
- **必须带引号**：每个 key 必须写作 \`"affinity.judy.trust":\`，不允许 \`affinity.judy.trust:\`（无引号会被 yaml 解析成嵌套对象）

**命名空间约定**（推荐前缀）：
- \`affinity.<char_slug>.<axis>\` — 角色好感轴（共享或特异）
- \`flags.<event_name>\` — 关键事件 boolean 标记

### 类型集合（4 种）

| type | 用途 | 必须含 | consequences 语义 |
|------|------|--------|------------------|
| \`int\` | 数值轴（共享或特异 axes） | \`range: [min, max]\` | delta（加减） |
| \`bool\` | 事件标记（flags） | — | 绝对覆盖 |
| \`enum\` | 离散选项（较少用） | \`values: [...]\` | 绝对覆盖 |
| \`string\` | 任意短文本（较少用） | — | 绝对覆盖 |

**不支持**：list / float / datetime / nested object。

### 字段元信息（每个字段必填）

每个 schema 字段都是一个对象，**必须**包含：

- \`desc: string\` — 字段语义说明，必填
- \`type\` — 上面四种之一
- \`default\` — 字段默认值，类型匹配 type。对于共享轴，如果该角色在 \`set_character_axes\` 设置了 \`shared_initial_overrides\`，那么 default 应该是覆盖后的值
- 根据 type：
  - \`int\` → 必须含 \`range\`
  - \`enum\` → 必须含 \`values\`，且 \`default\` 必须在 values 内

### 完整示例（3 个角色 + 2 个 flag）

假设 story-spec 声明了 \`shared_axes_custom: [trust, rivalry]\` 和 2 个 flags：

\`\`\`json
"state_schema": {
  "affinity.illya.bond":       { "desc": "伊莉雅的亲密度",           "type": "int", "range": [0, 10], "default": 5 },
  "affinity.illya.trust":      { "desc": "伊莉雅对玩家的信任",       "type": "int", "range": [0, 10], "default": 5 },
  "affinity.illya.rivalry":    { "desc": "伊莉雅视玩家为对手的程度", "type": "int", "range": [0, 10], "default": 2 },
  "affinity.illya.self_worth": { "desc": "伊莉雅的自我价值感（专属）", "type": "int", "range": [0, 10], "default": 3 },

  "affinity.rin.bond":    { "desc": "凛的亲密度",         "type": "int", "range": [0, 10], "default": 5 },
  "affinity.rin.trust":   { "desc": "凛对玩家的信任",     "type": "int", "range": [0, 10], "default": 5 },
  "affinity.rin.rivalry": { "desc": "凛的竞争心",         "type": "int", "range": [0, 10], "default": 3 },

  "affinity.kotomine.bond":    { "desc": "绮礼的亲密度（反派初始极低）",     "type": "int", "range": [0, 10], "default": 1 },
  "affinity.kotomine.trust":   { "desc": "绮礼对玩家的信任（反派初始极低）", "type": "int", "range": [0, 10], "default": 1 },
  "affinity.kotomine.rivalry": { "desc": "绮礼的敌意（反派初始高）",         "type": "int", "range": [0, 10], "default": 8 },

  "flags.met_illya":              { "desc": "玩家首次正式遇到伊莉雅", "type": "bool", "default": false },
  "flags.truth_of_grail_revealed": { "desc": "圣杯真相被揭露",       "type": "bool", "default": false }
}
\`\`\`

JSON 没有注释语法，如果想为某个字段记录"这个 default 来自 shared_initial_overrides"之类的说明，把它写进 \`desc\` 字符串里（如 \`"desc": "绮礼的敌意（反派 override 到 8）"\`）。

### initial_state 严格对齐 schema

\`"initial_state"\` 字段紧跟在 \`"state_schema"\` 之后：
- 字段集**严格 ==** state_schema 字段集（缺一不可、多一不可）
- 每个字段值**通常等于** schema.default

\`\`\`json
"initial_state": {
  "affinity.illya.bond": 5,
  "affinity.illya.trust": 5,
  "affinity.illya.rivalry": 2,
  "affinity.illya.self_worth": 3,
  "affinity.rin.bond": 5,
  "affinity.rin.trust": 5,
  "affinity.rin.rivalry": 3,
  "affinity.kotomine.bond": 1,
  "affinity.kotomine.trust": 1,
  "affinity.kotomine.rivalry": 8,
  "flags.met_illya": false,
  "flags.truth_of_grail_revealed": false
}
\`\`\`

### 共享轴完整性自检（写完后必做）

在你 Write script.json 之前，**必须**完成以下自检：

1. 从 story-spec.md 的 **Story State** 节读出 \`shared_axes_custom\`（2 个非 bond 名字）
2. 期望的共享轴集合 = \`{bond, <shared_axes_custom[0]>, <shared_axes_custom[1]>}\`（共 3 个）
3. 对每个角色 \`<char_slug>\`，验证 state_schema 中含以下 3 个字段：
   - \`"affinity.<char_slug>.bond"\`
   - \`"affinity.<char_slug>.<shared_axis_1>"\`
   - \`"affinity.<char_slug>.<shared_axis_2>"\`
4. 任何角色缺失任一共享轴 → 修正后重写

### flags 集合一致性自检（写完后必做）

1. 从 story-spec.md 的 **Story State** 节读出 \`flags\` 列表的 name 集合
2. 从 state_schema 中提取所有 \`"flags.<name>"\` key 的 name 集合（去掉 \`flags.\` 前缀）
3. 两个集合**必须严格相等**（缺一不可、多一不可）
4. 不一致 → 修正 scenes 的 consequences 引用 → 重写

**绝对不允许**：创造 story-spec 中未声明的 flag 名。即使你觉得故事需要一个额外的 flag，也必须通过重新 export（让 export agent 更新 story_state）来解决，而不是自己造。
`
}

/**
 * Endings DSL section: structured condition language for ending selection.
 * Each ending's condition is a tree of comparison + boolean nodes that the
 * runtime can evaluate mechanically without semantic interpretation. The
 * last ending in the array MUST use \`condition: default\` as a guaranteed
 * fall-through.
 */
function buildEndingsDslSection(): string {
  return `## endings condition 结构化 DSL

endings 数组中每个 ending 的 \`condition\` 字段**必须**是结构化 DSL 节点，**不接受**自然语言字符串表达式。

### 节点类型

**比较节点** —— 引用 schema 字段做比较：
\`\`\`yaml
{ key: "<schema 字段字面 key>", op: "<算子>", value: <值> }
\`\`\`

支持的算子：
- \`>= / <= / > / <\` — 仅适用于 \`int\` 字段
- \`== / !=\` — 适用于所有类型

**逻辑组合节点** —— 可任意嵌套：
\`\`\`yaml
{ all_of: [ <node>, <node>, ... ] }   # AND
{ any_of: [ <node>, <node>, ... ] }   # OR
{ not: <node> }                       # NOT
\`\`\`

**跨角色聚合节点**（仅对**共享 axes** 有效）：
\`\`\`yaml
# 对所有角色（去掉 except 列表），该共享轴都满足条件
all_chars:
  axis: bond
  op: ">="
  value: 7
  except: [<char_slug>, ...]   # 可选，排除特定角色

# 至少一个角色（去掉 except 列表），该共享轴满足条件
any_char:
  axis: trust
  op: ">="
  value: 8
  except: [<char_slug>, ...]   # 可选
\`\`\`

**关键限制**：\`all_chars\` / \`any_char\` 的 \`axis\` 只能是**共享轴**（\`bond\` 或 story-spec 中 \`shared_axes_custom\` 声明的 2 个）。**不能**引用角色特异轴（特异轴每个角色不同名，不能跨角色聚合）。

**兜底字面**：
\`\`\`yaml
condition: default
\`\`\`
（字符串字面量 \`default\`，永远 true）

### 完整示例

假设 story-spec 的 shared_axes_custom = [trust, rivalry]，角色 slugs = [illya, rin, kotomine]（其中 kotomine 是反派）：

\`\`\`yaml
endings:
  # 示例 1: 全体接纳 —— all_chars 聚合所有角色（排除反派）
  - id: "ending-unity"
    title: "众志成城"
    condition:
      all_of:
        - all_chars:
            axis: bond
            op: ">="
            value: 7
            except: [kotomine]
        - { key: "flags.truth_of_grail_revealed", op: "==", value: true }
    body: |
      （所有角色都站在主角一边...）

  # 示例 2: 双角色对立 —— 引用特定角色的共享轴 + 特异轴
  - id: "ending-illya-route"
    title: "伊莉雅专属结局"
    condition:
      all_of:
        - { key: "affinity.illya.bond", op: ">=", value: 8 }
        - { key: "affinity.illya.self_worth", op: ">=", value: 7 }  # 特异轴
        - { key: "affinity.rin.rivalry", op: ">=", value: 6 }       # 凛敌意高
    body: |
      ...

  # 示例 3: 任一角色觉悟 —— any_char
  - id: "ending-breakthrough"
    title: "至少一人觉悟"
    condition:
      any_char:
        axis: trust
        op: ">="
        value: 9
    body: |
      ...

  # 示例 4: 复杂嵌套 —— all_chars 套 all_of
  - id: "ending-rebel"
    title: "反抗结局"
    condition:
      any_of:
        - all_of:
            - { key: "affinity.illya.bond", op: ">=", value: 8 }
            - { key: "flags.truth_of_grail_revealed", op: "==", value: true }
        - all_chars:
            axis: rivalry
            op: "<="
            value: 3
            except: [kotomine]

  - id: "ending-default"
    title: "默认结局"
    condition: default
    body: |
      （兜底结局）
\`\`\`

### 强制规则

- **最后一个 ending 必须** \`condition: default\`，作为无条件兜底
- 比较节点的 \`key\` 必须存在于 \`state_schema\`
- 比较节点的 \`value\` 类型必须匹配 \`state_schema[key].type\`
- enum 字段的 \`value\` 必须在 \`schema.values\` 列表内
- bool 字段不能用 \`>= / <= / > / <\`，只能 \`== / !=\`
- \`all_chars\` / \`any_char\` 的 \`axis\` **只能**是共享轴，不能是特异轴
- \`all_chars\` / \`any_char\` 的 \`except\` 列表里的名字必须是实际存在的角色 slug

### 评估算法（你在 Phase 3 触发结局时按此执行）

\`\`\`
evaluate(node, state, schema, characters):
  if node === "default":
    return true

  if node has all_of:
    return all children evaluate true
  if node has any_of:
    return any child evaluates true
  if node has not:
    return not evaluate(child)

  if node has key/op/value:
    if schema[key] is None: return false
    current = state[key]
    return apply_op(current, op, value)

  if node has all_chars:
    included = characters - (node.all_chars.except or [])
    for char in included:
      key = \`affinity.\${char}.\${node.all_chars.axis}\`
      if schema[key] is None: return false
      current = state[key]
      if not apply_op(current, node.all_chars.op, node.all_chars.value):
        return false
    return true

  if node has any_char:
    included = characters - (node.any_char.except or [])
    for char in included:
      key = \`affinity.\${char}.\${node.any_char.axis}\`
      if schema[key] is None: continue
      current = state[key]
      if apply_op(current, node.any_char.op, node.any_char.value):
        return true
    return false

# 顺序遍历 endings 数组，第一个 evaluate 为 true 的 ending 触发
for ending in endings:
  if evaluate(ending.condition, state, schema, characters):
    展示 ending → 退出
\`\`\`
`
}

export function generateSkillMd(config: SkillTemplateConfig): string {
  const {
    skillName,
    storyName,
    worldDisplayName,
    description,
    characters,
    acts_options,
    default_acts,
    expectedFileCount,
    expectedTextSizeKb,
  } = config

  const isMultiCharacter = !!characters && characters.length > 1
  // For the multi-character intro display, we use the original (possibly CJK) name.
  const protagonistDisplayName =
    characters?.find((c) => c.role === 'protagonist')?.name
    ?? characters?.[0]?.name
    ?? storyName
  // For the single-character engine's path references, we pass the ASCII slug.
  // Without a CharacterSpecWithSlug entry (zero characters configured), fall
  // back to a slug derived from the storyName so the legacy single-character
  // template still produces ASCII paths.
  const protagonistSlug =
    characters?.find((c) => c.role === 'protagonist')?.slug
    ?? characters?.[0]?.slug
    ?? skillName

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

  // Build a path mapping table when there are multi-character cast members.
  // The Anthropic Skill spec requires ASCII-only directory names, but the
  // user-facing character names may be CJK ("远坂凛"). The packager turns
  // each name into a slug ("skill-abc12345") and we surface that mapping
  // here so the LLM knows that to read 远坂凛's identity it must open
  // souls/skill-abc12345/identity.md, not souls/远坂凛/identity.md.
  const characterPathMapping = characters && characters.length > 0
    ? `\n## 角色路径映射（重要）\n\n本 skill 内的所有角色文件路径使用 ASCII slug，因为 Anthropic Skill 规范要求归档内只包含 ASCII 文件路径。当你需要读取某个角色的 identity / style / capabilities / milestones / behaviors 时，**必须**使用下表中的 slug：\n\n${characters.map((c) => `- **${c.display_name ?? c.name}** → \`souls/${c.slug}/\``).join('\n')}\n\n例如：要读取 ${characters[0]!.display_name ?? characters[0]!.name} 的 identity，调用 \`Read \${CLAUDE_SKILL_DIR}/souls/${characters[0]!.slug}/identity.md\`。\n\n本文档其余部分提到 \`souls/{角色名}/...\` 时，{角色名} 是占位符，**实际路径请用上表的 slug 替换**。\n`
    : ''

  const enginePart = isMultiCharacter
    ? buildMultiCharacterEngine(characters!, { expectedFileCount, expectedTextSizeKb })
    : buildSingleCharacterEngine(
        storyName,
        worldDisplayName,
        protagonistSlug,
        protagonistDisplayName,
        { expectedFileCount, expectedTextSizeKb },
      )

  return `---
name: ${skillName}
description: ${description}
allowed-tools: AskUserQuestion Read Write Glob Edit Bash
---

${intro}
${characterPathMapping}

${buildPlatformNotice()}

${buildPhaseMinusOne()}

${buildSaveSystemSection()}

${phase0}

# Phase 1 创作约束（必须在生成 script 时遵守）

${buildStateSchemaSection()}

${buildEndingsDslSection()}

${enginePart}
`
}
