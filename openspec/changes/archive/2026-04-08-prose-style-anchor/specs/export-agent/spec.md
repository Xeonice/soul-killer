## ADDED Requirements

### Requirement: set_prose_style 工具
Export Agent SHALL 提供 `set_prose_style` 工具用于一次性预定义本故事的叙事风格锚点。该工具的 description SHALL inline 通用中文翻译腔反例库（ZH_TRANSLATESE_PATTERNS），让 agent 在做决策时直接看到完整症状学。

#### Scenario: set_prose_style 接受合法 ProseStyle
- **WHEN** Agent 调用 `set_prose_style({ target_language: 'zh', voice_anchor, forbidden_patterns, ip_specific })`
- **AND** voice_anchor 长度 ≥ 20 字
- **AND** forbidden_patterns 长度 ≥ 3
- **AND** ip_specific 长度 ≥ 3
- **THEN** SHALL 将参数保存到 ExportBuilder 的 proseStyle 字段
- **AND** 返回 `{ ok: true, summary }`

#### Scenario: set_prose_style 校验失败
- **WHEN** Agent 调用 set_prose_style 时 voice_anchor 长度 < 20
- **THEN** SHALL 返回 `{ error: "voice_anchor must be at least 20 characters" }`
- **AND** 不写入 builder

#### Scenario: 工具 description 包含反例库
- **WHEN** export agent 启动并加载工具列表
- **THEN** set_prose_style 工具的 description SHALL 包含 ZH_TRANSLATESE_PATTERNS 中所有条目的渲染（id / bad / good / reason）

### Requirement: ExportBuilder 累积 prose_style 并强制存在
ExportBuilder SHALL 新增 `proseStyle?: ProseStyle` 字段，由 setProseStyle 方法写入；build() 时 SHALL 把 proseStyle 带到生成的 StorySpecConfig.prose_style 字段。build() 在 `proseStyle` 缺失时 SHALL throw error，让 finalize_export 工具返回 `{ error }` 以触发 agent 自修正。

#### Scenario: builder 持久化 prose_style
- **WHEN** 调用 `builder.setProseStyle(s)` 后再调用 `builder.build()`
- **THEN** 返回的 story_spec 对象 SHALL 含 `prose_style: s`

#### Scenario: prose_style 缺失时 build 失败
- **WHEN** 没有调用 setProseStyle 就直接 finalize_export
- **THEN** build() SHALL throw error `"prose_style is required — call set_prose_style before finalize_export"`
- **AND** finalize_export tool SHALL 返回 `{ error: <message> }`
- **AND** agent 在下一轮 SHALL 看到错误并补调 set_prose_style

### Requirement: add_character 接受 character_voice_summary 可选字段
add_character 工具 SHALL 接受可选的 `character_voice_summary?: string` 参数。当某角色 style.md 含非目标语言占比 > 30% 时，agent SHALL 提供该字段；其他情况下省略。

#### Scenario: 异质语言角色提供 voice_summary
- **WHEN** Agent 在 add_character 中提供 `character_voice_summary: "間桐桜：温柔克制的敬语..."`
- **AND** 字段长度 ≤ 200 字
- **THEN** SHALL 写入 builder 的 character draft
- **AND** finalize_export 时合并到 story_spec.prose_style.character_voice_summary[character_name]

#### Scenario: voice_summary 超长拒绝
- **WHEN** character_voice_summary 长度 > 200 字
- **THEN** add_character SHALL 返回 `{ error: "character_voice_summary 不超过 200 字" }`

## MODIFIED Requirements

### Requirement: 分阶段工具集
Export Agent SHALL 通过分阶段工具集（set_story_metadata + set_story_state + **set_prose_style** + add_character + set_character_axes + finalize_export）替代单次大调用。每个工具的 input 都 SHALL 控制在小尺寸以避免 LLM 生成失败。finalize_export 不接受 output_dir 参数（由 CLI 层控制）；finalize_export 的输出 SHALL 反映 `.skill` 归档文件路径而非展开目录路径。

**prose-style-anchor 新增约束**：
- `set_prose_style` SHALL 在 `set_story_state` 之后、任何 `add_character` 之前调用
- `add_character` SHALL 接受可选 `character_voice_summary` 字段

#### Scenario: set_story_metadata 设定故事框架
- **WHEN** Agent 调用 `set_story_metadata({ genre, tone, constraints, acts_options, default_acts })`
- **AND** acts_options 包含 2-3 个 ActOption 元素
- **AND** default_acts 等于 acts_options 中某项的 acts 值
- **THEN** SHALL 将参数保存到 ExportBuilder 的 metadata 字段
- **AND** 返回 `{ ok: true, summary }`

#### Scenario: set_prose_style 必须在 finalize_export 前完成
- **WHEN** Agent 在 finalize_export 时尚未调用 set_prose_style
- **THEN** finalize_export SHALL 返回 `{ error: "prose_style is required — call set_prose_style before finalize_export" }`
- **AND** agent 下一轮 SHALL 补调 set_prose_style 后重试 finalize_export
- **AND** 标准流程是：set_story_metadata → set_story_state → set_prose_style → add_character → set_character_axes → finalize_export

#### Scenario: add_character 注册角色
- **WHEN** Agent 调用 `add_character({ name, role, display_name?, appears_from?, dynamics_note?, character_voice_summary? })`
- **AND** name 在 preSelected.souls 列表中
- **AND** 该 name 尚未添加过
- **THEN** SHALL 创建角色草稿加入 builder.characters
- **AND** 返回 `{ ok: true, summary }`

#### Scenario: set_character_axes 设置好感轴
- **WHEN** Agent 调用 `set_character_axes({ character_name, specific_axes, shared_initial_overrides? })`
- **AND** character_name 已通过 add_character 添加
- **THEN** SHALL 写入对应角色草稿
- **AND** 返回 `{ ok: true, summary }`

#### Scenario: finalize_export 触发打包并返回归档路径
- **WHEN** Agent 调用 `finalize_export({})`
- **AND** ExportBuilder 状态完整
- **THEN** SHALL 通过 builder.build() 构造 story_spec
- **AND** SHALL 调用 packageSkill 生成 `.skill` 归档文件
- **AND** 返回值 SHALL 包含 `output_file`, `file_count`, `size_bytes`, `skill_file_name`, `soul_count`
- **AND** SHALL 不再包含 `output_dir` 或 `files` 数组字段

#### Scenario: complete 进度事件适配
- **WHEN** finalize_export 成功
- **THEN** SHALL 发出 `complete` 事件且 payload 包含 `.skill` 文件路径
- **AND** 事件字段 SHALL 包括: `output_file: string`, `file_count: number`, `size_bytes: number`, `skill_name: string`

### Requirement: System prompt 引导分阶段调用
Export Agent 的 SYSTEM_PROMPT SHALL 明确指引 agent 按 set_story_metadata → set_story_state → **set_prose_style** → add_character + set_character_axes (per character) → finalize_export 的顺序调用工具。SYSTEM_PROMPT 中 SHALL 包含 §3.5「叙事风格锚点决策」章节，引导 agent 根据 world manifest + characters 推断本故事的 prose style，并从通用反例库选择 ≥ 3 条 forbidden_patterns，自己现编 ≥ 3 条 ip_specific 规则。

#### Scenario: Prompt 包含 6 步工作流说明
- **WHEN** 构造 SYSTEM_PROMPT
- **THEN** SHALL 包含 6 步顺序：set_story_metadata → set_story_state → set_prose_style → add_character → set_character_axes → finalize_export
- **AND** SHALL 强调每次调用 input 简短
- **AND** SHALL 说明遇到 error 应根据信息修正后重试

#### Scenario: Prompt §3.5 章节
- **WHEN** 构造 SYSTEM_PROMPT
- **THEN** SHALL 含「叙事风格锚点决策」章节
- **AND** SHALL 说明 voice_anchor 必须含具体 IP 类型词
- **AND** SHALL 说明 ip_specific 至少 3 条具体规则（拒绝抽象描述）
- **AND** SHALL 说明何时为角色提供 character_voice_summary（非目标语言占比 > 30%）

#### Scenario: 终止条件
- **WHEN** 配置 stopWhen
- **THEN** SHALL 包含 `hasToolCall('finalize_export')` 作为成功终止条件
