## 1. 通用反例库与 prose_style 类型

- [x] 1.1 新建 `src/export/prose-style/zh-translatese-patterns.ts`，定义 `ProseStyleForbiddenPattern` interface（id / bad / good / reason）
- [x] 1.2 在同一文件导出 `ZH_TRANSLATESE_PATTERNS: ProseStyleForbiddenPattern[]`，至少 8 条：`degree_clause`、`gaze_level`、`possessive_chain`、`abstract_noun`、`literal_metaphor`、`held_back_negative`、`night_of_event`、`small_body`
- [x] 1.3 每条反例的 bad / good 字段必须是真实可对比的中文段落（不是抽象描述）
- [x] 1.4 新建 `src/export/prose-style/index.ts`，re-export 反例库 + 提供 `formatPatternsForToolDescription()` 渲染函数
- [x] 1.5 单测 `tests/unit/prose-style-patterns.test.ts`：覆盖反例库结构完整性、id 唯一性、formatPatternsForToolDescription 渲染格式

## 2. ProseStyle 数据结构与 StorySpecConfig 扩展

- [x] 2.1 在 `src/export/story-spec.ts` 中新增 `ProseStyle` interface：`{ target_language, voice_anchor, forbidden_patterns, ip_specific, character_voice_summary? }`
- [x] 2.2 复用 `src/export/prose-style/` 的 `ProseStyleForbiddenPattern` 类型；从 `prose-style/index.ts` import 而非重复定义
- [x] 2.3 扩展 `StorySpecConfig` 加 `prose_style?: ProseStyle` 字段（可选，向后兼容）
- [x] 2.4 扩展 `CharacterSpec` 加 `voice_summary?: string` 字段（在 add_character 时由 agent 提供）
- [x] 2.5 单测：interface 结构由后续 ExportBuilder 测试间接覆盖

## 3. ExportBuilder 累积层

- [x] 3.1 在 `src/agent/export-agent.ts` 的 `ExportBuilder` 类中新增 `proseStyle?: ProseStyle` 字段
- [x] 3.2 新增 `setProseStyle(s: ProseStyle): void` 方法：校验 voice_anchor ≥ 20 字、forbidden_patterns ≥ 3 条、ip_specific ≥ 3 条、target_language === 'zh'
- [x] 3.3 setProseStyle 校验 ip_specific 每条不能是抽象描述（heuristic：长度 ≥ 10 字 + 不含纯抽象词如"应该"/"克制"开头）；不通过返回 warning 但不阻塞
- [x] 3.4 修改 `addCharacter` 接受 `voice_summary?: string`（≤ 200 字校验），写入 character draft
- [x] 3.5 修改 `build()` 把 proseStyle 和每个 character.voice_summary 合并到生成的 StorySpecConfig.prose_style.character_voice_summary
- [x] 3.6 build() 时 proseStyle 缺失 **throw error** `"prose_style is required — call set_prose_style before finalize_export"`；finalize_export 工具捕获后返回 `{ error }` 让 agent 自修正
- [x] 3.7 单测 `tests/unit/export-builder.test.ts` 新增 setProseStyle + build 场景测试（含 happy / 短 voice_anchor / forbidden_patterns 不足 / ip_specific 不足 / character voice_summary 超长 / addCharacter 拒绝 voice_summary 超长 / build 缺 proseStyle throw / build 含 prose_style 传递 / character_voice_summary 合并）

## 4. set_prose_style tool 定义

- [x] 4.1 在 export-agent.ts 的 tools 对象新增 `set_prose_style` tool（vercel AI SDK 的 `tool` helper）
- [x] 4.2 zod schema：`target_language: z.literal('zh')`、`voice_anchor: z.string().min(20)`、`forbidden_patterns: z.array(z.object({id, bad, good, reason})).min(3)`、`ip_specific: z.array(z.string()).min(3)`
- [x] 4.3 tool description 通过 `formatPatternsForToolDescription(ZH_TRANSLATESE_PATTERNS)` 动态渲染，包含完整反例库 + 决策原则说明（"voice_anchor 必须含具体 IP 类型词"等）
- [x] 4.4 tool execute 函数：调用 `builder.setProseStyle(args)`，返回 `{ ok: true, summary }` 或 `{ error }`
- [x] 4.5 onProgress 事件发送：tool_start / tool_end
- [x] 4.6 修改 `add_character` 工具的 zod schema，加入可选 `voice_summary: z.string().max(200).optional()`
- [x] 4.7 单测：set_prose_style 的 success/error 路径由 ExportBuilder.setProseStyle 单测间接覆盖；tool execute 是薄 wrapper

## 5. Export agent system prompt 工作流更新

- [x] 5.1 修改 `SYSTEM_PROMPT` 工作流段：从 4 步改为 5 步，Step 3 是 set_prose_style
- [x] 5.2 新增「§3.5 叙事风格锚点决策」章节，含决策原则 / voice_anchor 写作指引 / forbidden_patterns 选择策略 / ip_specific 现编引导 / character_voice_summary 触发条件
- [x] 5.3 §3.5 明确指引："voice_anchor 必须含具体 IP 类型词（type-moon / 古典章回 / 赛博朋克 / 校园日常 等），不能是 'fantasy' 这种抽象词"
- [x] 5.4 §3.5 明确指引："ip_specific 至少 3 条具体规则，包含 1 条术语保留规则、1 条称谓/敬语规则、1 条比喻/意象池规则"
- [x] 5.5 §3.5 明确指引："读完每个角色 style.md 后，估算非中文占比；> 30% 时在 add_character 时提供 voice_summary"
- [x] 5.6 §4 (角色注册) 章节同步加 voice_summary 字段说明
- [x] 5.7 stopWhen 无需改动（原有 `hasToolCall('finalize_export')` 仍然是成功终止条件；set_prose_style 顺序约束由 builder 校验 + finalize_export 返回 error 强制）

## 6. story-spec.md 模板：叙事风格锚点章节

- [x] 6.1 在 `src/export/story-spec.ts` 中新增 `formatProseStyleSection(proseStyle: ProseStyle): string` 函数 + `formatProseStyleFallbackSection()`
- [x] 6.2 输出格式：`## 叙事风格锚点` 标题 + yaml fenced block 包含完整 ProseStyle 结构（machine-parseable）
- [x] 6.3 缺 prose_style 时输出 fallback 节：`## 叙事风格锚点（fallback）`，引用通用反例库的 5 条最高频条目
- [x] 6.4 修改 `generateStorySpec` 在 Story State 章节之后、角色列表之前注入 prose_style 章节
- [x] 6.5 单测 `tests/unit/export.test.ts`：3 个新测试（含 prose_style / fallback / 引号转义）

## 7. SKILL.md 模板：Phase 1 引用 prose_style

- [x] 7.1 在 `buildMultiCharacterEngine` 的 Phase 1 创作步骤 Step 3 (写 scenes) 前加引导段（多角色引擎新增 Step 5.g prose_style 反例对照自检）
- [x] 7.2 Step 5.g 新增自检：检查所有 narration / dialogue 字符串是否触犯 forbidden_patterns 中任一条
- [x] 7.3 同步 `buildSingleCharacterEngine` 的 Phase 1 创作步骤（Step 5.d）
- [x] 7.4 单测：tests/unit/export.test.ts 新增 "Phase 1 creation steps reference prose_style forbidden_patterns before writing scenes"

## 8. SKILL.md 模板：Phase 2 引用 prose_style

- [x] 8.1 修改 `buildMultiCharacterEngine` 的 Phase 2 加「叙事风格约束」段
- [x] 8.2 列出 5 条最高频翻译腔模式作为硬约束清单
- [x] 8.3 加 character_voice_summary 引用："有 voice_summary 的角色优先使用 summary 作为中文声音锚点"
- [x] 8.4 同步 `buildSingleCharacterEngine` 的 Phase 2
- [x] 8.5 单测：tests/unit/export.test.ts 新增 "Phase 2 scene rendering lists high-frequency translatese patterns to avoid"

## 9. SKILL.md 模板：fallback 渲染

- [x] 9.1 当 StorySpecConfig.prose_style 缺失时，story-spec.md 渲染 fallback 段（由 `formatProseStyleFallbackSection` 实现）；SKILL.md 模板在 Phase 1/2 都指示 LLM 去 read story-spec.md 的该 fallback 章节作为约束
- [x] 9.2 fallback 段直接 inline 通用反例库的 5 条最高频条目作为禁忌（`topForbiddenPatterns(5)`）
- [x] 9.3 单测：tests/unit/export.test.ts 的 "emits prose_style fallback section when prose_style is missing" 覆盖

## 10. Packager 集成

- [x] 10.1 packager 自动 passthrough：`generateStorySpec(story_spec)` 已在 packager.ts:233 调用，StorySpecConfig.prose_style 自动流向 story-spec.md，无需改动 packager
- [x] 10.2 单测由 generateStorySpec 层的 3 个 prose_style 测试间接覆盖（packager 只是薄 wrapper）

## 11. 文档与注释

- [x] 11.1 在 `CLAUDE.md` 的 "Export / Skill format" 小节加 prose_style 简述
- [x] 11.2 `src/export/story-spec.ts` 的 ProseStyle interface 已有完整 JSDoc（Group 2 写入）
- [x] 11.3 `src/agent/export-agent.ts` 的 setProseStyle 方法有 JSDoc；set_prose_style tool description 包含完整决策原则（Group 3/4 写入）
- [x] 11.4 `src/export/prose-style/zh-translatese-patterns.ts` 顶部有完整 JSDoc 说明扩展规则（Group 1 写入）

## 12. 端到端验证

- [x] 12.1 由 ExportBuilder 单测 + export-agent 工具 schema 覆盖：6 步强制顺序（set_story_metadata → set_story_state → set_prose_style → add_character → set_character_axes → finalize_export），build() 缺 prose_style 直接 throw
- [x] 12.2 由 tests/unit/export.test.ts 的 "emits prose_style section with voice_anchor / forbidden_patterns / ip_specific when provided" 覆盖
- [x] 12.3 由 tests/unit/export.test.ts 的 "Phase 1 creation steps reference prose_style forbidden_patterns" + "Phase 2 scene rendering lists high-frequency translatese patterns to avoid" 覆盖
- [ ] 12.4 (manual) 在 Claude Code 加载新 fsn skill，对比運行 Phase 2 输出与旧 skill 的中文质量
- [ ] 12.5 (manual) 验证 fsn 间桐桜场景：observable 的翻译腔症状（degree_clause / possessive_chain）是否减少
- [ ] 12.6 (manual) 用三国 souls export，验证非日系 IP 的 prose_style 决策是否合理（古典章回风 vs type-moon 风）
- [ ] 12.7 (manual) 验证 character_voice_summary 在 fsn 角色 style.md 含日文引文时被 export agent 主动提供
