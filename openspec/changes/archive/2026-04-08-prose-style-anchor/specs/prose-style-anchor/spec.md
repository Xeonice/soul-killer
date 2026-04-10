## ADDED Requirements

### Requirement: ProseStyle 数据结构
系统 SHALL 定义 `ProseStyle` interface，作为故事级叙事风格锚点，包含 `target_language` / `voice_anchor` / `forbidden_patterns` / `ip_specific` / 可选 `character_voice_summary` 五个字段。该结构在 export 阶段由 export agent 一次性预定义，下游 Phase 1/2 引用作为写作硬约束。

#### Scenario: ProseStyle 结构完整性
- **WHEN** 解析一个合法的 ProseStyle 对象
- **THEN** SHALL 包含 `target_language: 'zh'`（第一版只支持 zh）
- **AND** SHALL 包含 `voice_anchor: string`（自由文本，至少 20 字）
- **AND** SHALL 包含 `forbidden_patterns: ProseStyleForbiddenPattern[]`（至少 3 条）
- **AND** SHALL 包含 `ip_specific: string[]`（至少 3 条 bullet）
- **AND** MAY 包含 `character_voice_summary: Record<string, string>`

#### Scenario: forbidden_patterns 条目结构
- **WHEN** 解析一个 forbidden_pattern 条目
- **THEN** SHALL 包含 `id: string`、`bad: string`、`good: string`、`reason: string` 四个字段

### Requirement: 通用中文翻译腔反例库
系统 SHALL 在 `src/export/prose-style/zh-translatese-patterns.ts` 中维护通用中文翻译腔反例库，作为 TypeScript 模块导出 `ZH_TRANSLATESE_PATTERNS: ProseStyleForbiddenPattern[]`。库 SHALL 包含至少 8 条覆盖常见翻译腔模式的条目，每条含 id / bad / good / reason。

#### Scenario: 反例库覆盖核心模式
- **WHEN** 加载 ZH_TRANSLATESE_PATTERNS
- **THEN** SHALL 至少包含以下 id 的条目：`degree_clause`、`gaze_level`、`possessive_chain`、`abstract_noun`、`literal_metaphor`、`held_back_negative`、`night_of_event`、`small_body`

#### Scenario: 反例库可被代码 import
- **WHEN** 模块从 `src/export/prose-style/index.ts` import ZH_TRANSLATESE_PATTERNS
- **THEN** SHALL 拿到一个非空 array，每条都符合 ProseStyleForbiddenPattern 结构

### Requirement: 反例库 inline 到 set_prose_style 工具 description
`set_prose_style` 工具的 description 字段 SHALL 包含通用反例库的完整内容（每条 id + bad + good + reason），让 export agent 在做风格决策时直接看到完整症状学，不需要额外 tool call。

#### Scenario: 工具 description 包含反例库
- **WHEN** export agent 准备调用 set_prose_style 工具
- **THEN** 工具的 description SHALL 包含 ZH_TRANSLATESE_PATTERNS 中所有条目的渲染

#### Scenario: 反例库变化时 description 同步
- **WHEN** ZH_TRANSLATESE_PATTERNS 添加新条目
- **THEN** set_prose_style 工具 description 自动反映新条目（通过函数渲染而非硬编码字符串）

### Requirement: ip_specific 字段约束
`ip_specific` 字段 SHALL 是 export agent 根据具体故事现编的规则列表，长度至少 3 条。每条 bullet SHALL 是具体可执行的规则，而非抽象方向（"应该克制"不算具体；"宝具/Servant 不译保留英文" 算具体）。

#### Scenario: 合规 ip_specific
- **WHEN** ip_specific 含 `["宝具/Servant/Master 保留英文", "敬语层级用'桜さん→樱小姐'", "魔术回路相关用片假名转写"]`
- **THEN** 工具接受该输入

#### Scenario: 抽象 ip_specific 警告
- **WHEN** ip_specific 含 `["应该克制", "保持日系感"]` 等抽象描述
- **THEN** 工具 SHALL 返回 warning（不阻塞，但 export agent 应当被引导改写为具体规则）

### Requirement: ProseStyle 序列化到 story-spec.md
`generateStorySpec()` SHALL 在生成的 story-spec.md 中加入「叙事风格锚点」章节，内含一个 yaml fenced block，包含完整的 ProseStyle 结构（machine-parseable）。该章节位于 Story State 章节之后、角色列表之前。

#### Scenario: story-spec.md 含 prose_style 节
- **WHEN** generateStorySpec 输入的 StorySpecConfig 含 prose_style
- **THEN** 输出的 story-spec.md SHALL 含 `## 叙事风格锚点` 标题
- **AND** SHALL 含一个 yaml fenced block 包含 prose_style 完整结构

#### Scenario: 缺 prose_style 时输出 fallback 节
- **WHEN** StorySpecConfig 不含 prose_style（向后兼容场景）
- **THEN** story-spec.md SHALL 含一个简短的 fallback 节，说明使用通用中文写作指引

### Requirement: character_voice_summary 检测和填写
当某角色的 style.md 含非目标语言占比 > 30% 时，export agent SHALL 在 add_character 工具调用中提供该角色的 `character_voice_summary` 字段（中文克制书面摘要，含 1-2 句标志性台词复述），不超过 200 字。

#### Scenario: fsn 角色 style.md 含日文残留
- **WHEN** 间桐桜的 style.md 含 60% 日文引文
- **THEN** export agent SHALL 在 add_character 时提供 character_voice_summary 字段
- **AND** 摘要 SHALL 是中文且不超过 200 字

#### Scenario: 三国角色 style.md 已是中文
- **WHEN** 诸葛亮的 style.md 99% 是中文
- **THEN** character_voice_summary SHALL 可以省略

### Requirement: prose_style 在 Phase 1 创作时被引用
SKILL.md Phase 1 创作步骤 SHALL 在 Step 3 (写 scenes) 和 Step 4 (写 endings) 前明确指示 LLM 引用 story-spec.md 的「叙事风格锚点」章节，把 forbidden_patterns 作为写 narration / dialogue 时的硬约束。

#### Scenario: Phase 1 创作步骤含 prose_style 引用
- **WHEN** 生成 SKILL.md
- **THEN** Phase 1 章节 SHALL 含一段引导："写 narration / dialogue 时，先读 story-spec.md 的『叙事风格锚点』章节，逐条对照 forbidden_patterns 自检"

### Requirement: prose_style 在 Phase 2 运行时被引用
SKILL.md Phase 2 场景呈现规则 SHALL 在"旁白"和"角色演绎"两个子项里加入 prose_style 引用条款，把 forbidden_patterns 当成场景输出的硬约束。

#### Scenario: Phase 2 场景呈现含 prose_style 条款
- **WHEN** 生成 SKILL.md
- **THEN** Phase 2「场景呈现规则」段 SHALL 列出 forbidden_patterns 的每一条作为禁忌
- **AND** SHALL 引导 LLM 把 ip_specific 当成本故事的术语规范
