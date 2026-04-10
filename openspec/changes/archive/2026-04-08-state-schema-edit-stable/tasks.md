## 1. SKILL.md frontmatter 与 allowed-tools

- [x] 1.1 修改 `src/export/skill-template.ts` 中 SKILL.md frontmatter，`allowed-tools` 追加 `Edit`，最终列表为 `AskUserQuestion, Read, Write, Glob, Edit`
- [x] 1.2 单测：验证生成的 SKILL.md frontmatter 含 `Edit` 工具

## 2. Phase 1 创作流程：state_schema 章节

- [x] 2.1 在 `src/export/skill-template.ts` 中新增 `buildStateSchemaSection()` 函数，输出 state_schema 创作约束章节
- [x] 2.2 章节内容包含：命名约束（snake_case + dot + ASCII + 引号）、类型集合（int/bool/enum/string）、字段元信息（desc 必填 / type 必填 / default 必填 / int 必含 range / enum 必含 values）、命名空间约定（affinity. / flags. / custom.）
- [x] 2.3 章节包含至少一个完整 state_schema yaml 示例
- [x] 2.4 在 buildSingleCharacterEngine 和 buildMultiCharacterEngine 的 Phase 1 章节调用 `buildStateSchemaSection()`（实现：从 generateSkillMd 顶层注入到 enginePart 之前，对单/多角色都生效）
- [x] 2.5 单测：snapshot 验证 SKILL.md 含 state_schema 章节及命名约束/类型集合关键字

## 3. Phase 1 创作流程：endings DSL 章节

- [x] 3.1 新增 `buildEndingsDslSection()` 函数，输出 endings condition 结构化 DSL 语法说明
- [x] 3.2 章节内容包含：比较节点形态、6 个算子、3 个逻辑节点（all_of/any_of/not）、`condition: default` 兜底语义
- [x] 3.3 包含至少一个嵌套 condition 完整 yaml 示例
- [x] 3.4 单测：验证 SKILL.md 含 DSL 章节和算子列表

## 4. Phase 1 创作流程：步骤指令

- [x] 4.1 修改 Phase 1 章节，明确指示 LLM 按 7 步顺序创作（schema → initial_state → scenes → endings → 自检 → Write → 进 Phase 2）
- [x] 4.2 自检步骤指令：列出 scenes/endings 引用的所有 key，对照 schema 字面比对，不符则重写对应部分
- [x] 4.3 移除 Phase 1 旧文本里"affinity / flags 由你自由命名"等冲突描述（旧 single-character endings 示例的字符串 condition 已替换为结构化 DSL；其他描述以"由 Phase 1 剧本定义"为主，与新方案一致，保留）
- [x] 4.4 单测：snapshot 验证 7 个步骤都在 Phase 1 章节中

## 5. Phase 2 场景流转：apply_consequences 伪代码 + Edit 工具

- [x] 5.1 在 `buildSingleCharacterEngine` 和 `buildMultiCharacterEngine` 的 Phase 2 章节新增 `## apply_consequences` 伪代码块
- [x] 5.2 伪代码包含完整流程：查 schema → 取当前值 → 按 type 计算 → 范围/values 校验 → Edit 行级替换
- [x] 5.3 明确指示用 Edit 工具的 `old_string`/`new_string` 形态（带引号 key + 旧/新值的精确字符串）
- [x] 5.4 明确指示场景流转后用 Edit 更新 current_scene 和 meta.yaml.last_played_at
- [x] 5.5 明确禁止用 Write 重写整个 state.yaml，并列出两个允许 Write 的例外（Phase 2 初始化 / 重玩重置）
- [x] 5.6 单测：验证 Phase 2 章节含 apply_consequences 伪代码 + Edit 工具调用形态 + 禁用 Write 的表述

## 6. state.yaml 行格式约定

- [x] 6.1 在 SKILL.md「存档机制」章节明确 state.yaml 的行格式（一行一字段，flat 字面字符串 key，两空格缩进）（实现：行格式说明嵌入到两个 engine 的 Phase 2 之后，与 apply_consequences 紧邻）
- [x] 6.2 列出严格的格式示例（含 current_scene、state 块、各类型字段的写法）
- [x] 6.3 明确禁止嵌套对象、跨行表达式、yaml block scalar
- [x] 6.4 单测：验证 SKILL.md 含 state.yaml 行格式约定

## 7. Phase -1 加载验证：四重检查

- [x] 7.1 在 `buildPhaseMinusOne()` 的「继续游戏」「重玩某个剧本」子流程之前新增「加载前验证」段落
- [x] 7.2 验证 1：dangling reference — Glob 检查 meta.yaml.script_ref 指向的 script 文件是否存在
- [x] 7.3 验证 2：state_schema 完整性 — Read script.yaml，检查顶部是否有 state_schema 块
- [x] 7.4 验证 3：initial_state 字段集对齐 — 解析 schema 和 initial_state，比较 key 集合
- [x] 7.5 验证 4：scenes consequences 抽样 — 抽 5 个 scene 的 consequences，验证每个 key 都在 schema 内
- [x] 7.6 「继续游戏」额外验证：state.yaml 字段集对齐
- [x] 7.7 单测：验证 Phase -1 含四重验证流程文本

## 8. 失败处理：legacy / 损坏 / 孤儿 / 修复菜单

- [x] 8.1 Phase -1 章节明确：state_schema 缺失 → 标 (legacy 不可重玩) → 仅提供"删除"入口
- [x] 8.2 Phase -1 章节明确：dangling script_ref → 标 (孤儿存档) → 提供"删除存档"入口
- [x] 8.3 Phase -1 章节明确：initial_state 不对齐 / consequences 引用非法 key → 标 (损坏) → 提供"删除剧本"
- [x] 8.4 「继续游戏」修复菜单：缺失字段 → 用 default 补；多余字段 → 丢弃；类型不符 → 重置为 default
- [x] 8.5 修复菜单使用 AskUserQuestion 询问用户：「修复后继续 / 完全重置 / 取消加载」
- [x] 8.6 单测：验证 Phase -1 章节含 legacy / 孤儿 / 损坏 / 修复菜单文本

## 9. 重玩规则：使用 Write 重置 state

- [x] 9.1 修改 SKILL.md 的「重玩规则」章节，明确指示用 Write 工具把 state.yaml 重置为 initial_state
- [x] 9.2 同时用 Write 把 meta.yaml 的 current_scene 重置为 scenes[0].id
- [x] 9.3 明确这是 Write 的允许例外（与 Phase 2 初始化并列）
- [x] 9.4 单测：验证「重玩规则」章节含 Write 重置 state.yaml 的指令

## 10. story-spec.md 状态系统章节同步

- [x] 10.1 修改 `src/export/story-spec.ts` 的 `buildSingleCharacterStateSystem()` / `buildMultiCharacterStateSystem()`，把"数值轴 / 关键事件标记 / 状态对象示例"同步为新 schema 范式
- [x] 10.2 状态系统章节明确说明 axes 会被 Phase 1 LLM 翻译为 `affinity.<character>.<axis>` schema 字段
- [x] 10.3 状态系统章节加一段"endings condition 用结构化 DSL"的说明（同时更新了 buildSingleCharacterEnding 和 buildMultiCharacterEnding，把字符串表达式示例换为 DSL 示例）
- [x] 10.4 单测：验证 story-spec.md 含新 schema 范式描述

## 11. 模板 lint：纯 ts 函数

- [x] 11.1 新建 `src/export/lint/index.ts` 和 `lint-skill-template.ts`
- [x] 11.2 实现 `lintSkillTemplate(content: string): LintReport`，返回 `{ ok, errors[], warnings[] }`
- [x] 11.3 检查 1：从 SKILL.md 模板中提取所有 yaml fenced code block，对每个调用极简 yaml parser 验证可解析
- [x] 11.4 检查 2：从 yaml block 中提取所有 schema 字段 key，验证命名规则（ASCII / snake_case / dot 分隔 / 带引号）
- [x] 11.5 检查 3：从 story-spec.md 提取 CharacterSpec.axes，验证跟 SKILL.md 模板里 schema 示例的 affinity 命名空间约定一致（lintCharacterAxesConsistency）
- [x] 11.6 检查 4：placeholder 格式扫描（v1 暂留为占位实现，注释里说明何时启用）
- [x] 11.7 单测：每个检查的正向 + 反向案例（13 个 test cases，全部通过）

## 12. packager 集成 lint

- [x] 12.1 修改 `src/export/packager.ts`，在生成 SKILL.md 内容之后、写入归档之前调用 `lintSkillTemplate(skillContent)`
- [x] 12.2 同时 lint story-spec.md 内容（lintStorySpec + lintCharacterAxesConsistency 都有调用）
- [x] 12.3 lint 失败时输出报告到 stderr，但**不**阻塞 packager 流程（reportLintIssues 函数实现）
- [x] 12.4 lint 报告格式：含错误清单 + 行号（如可定位）+ 简短说明
- [x] 12.5 单测：mock 一个错误的 SKILL.md 内容，验证 lint 报告含对应错误（由 export-lint.test.ts 中 13 个 case 覆盖；同时 export-tools.test.ts 验证 packager 集成不会破坏既有流程）

## 13. 文档与代码注释

- [x] 13.1 在 CLAUDE.md 中更新「Export / Skill format」小节，加 state_schema + Edit 行级更新的简短说明
- [x] 13.2 `src/export/lint/` 顶部加 docstring 说明 lint 范围（lint-skill-template.ts 顶部 + index.ts 顶部都有完整 docstring）
- [x] 13.3 `src/export/skill-template.ts` 中 `buildStateSchemaSection` / `buildEndingsDslSection` / `buildPhaseMinusOne` 等函数加注释（buildStateSchemaSection / buildEndingsDslSection 都有 JSDoc 三柱说明；buildPhaseMinusOne 在之前的 change 里已经加过）

## 14. 端到端验证

- [x] 14.1 用一个最小的 soul + world 调用 export，生成 .skill 包（由 `tests/unit/export-tools.test.ts` 自动覆盖）
- [x] 14.2 解压验证 SKILL.md 含 state_schema 章节、apply_consequences 伪代码、四重验证流程（export-tools.test.ts 已加断言）
- [ ] 14.3 在 Claude Code 加载 skill，手动跑 Phase 0 → Phase 1 → 看 LLM 是否正确生成含 state_schema 块的 script.yaml
- [ ] 14.4 检查 Phase 2 是否正确用 Edit 工具更新 state.yaml（不是 Write 重写）
- [ ] 14.5 重启 skill → Phase -1 → 选择「继续游戏」验证四重验证执行
- [ ] 14.6 选择「重玩当前剧本」验证 state.yaml 被重置为 initial_state
- [ ] 14.7 手动制造一个 dangling save（删除 script 文件），重启 skill 验证「孤儿」标记
- [ ] 14.8 用旧版 skill-template 生成的 script（无 state_schema 块）验证「legacy」hard fail 行为

## 15. Skill Spec Compliance Hot Fix — Formatter 模块

- [x] 15.1 新建 `src/export/format/skill-slug.ts`，导出 `formatSkillName(input)` 和 `formatPathSegment(input, fallbackPrefix?)`
- [x] 15.2 `formatSkillName` 实现：lowercase → 移除非 ASCII → 替换非 [a-z0-9-] 为 hyphen → 合并连续 hyphen → trim 首尾 hyphen → 截断 64 字符
- [x] 15.3 fallback 逻辑：sluglify 后为空时用 deterministic djb2 hash 生成 `skill-<8位 base36>`
- [x] 15.4 `formatPathSegment` 同样规则但 fallback 前缀可配置（默认 `seg`）
- [x] 15.5 单测：纯 ASCII / 含 CJK / 全 CJK / 长字符串截断 / 边界字符 / 首尾 hyphen / 连续 hyphen 等 case
- [x] 15.6 单测：相同输入永远产生相同 slug（deterministic）

## 16. Packager 集成 formatter

- [x] 16.1 修改 `src/export/packager.ts` 的 `toKebabCase`：删掉 CJK 保留逻辑，改成严格 ASCII 模式（直接调 formatter）
- [x] 16.2 `getSkillBaseName` 用新 formatter，确保结果符合 `^[a-z0-9]+(-[a-z0-9]+)*$`
- [x] 16.3 `buildSoulFiles` 用 `formatPathSegment(soulName, 'soul')` 计算 slug，作为 souls 子目录名
- [x] 16.4 `buildSoulFiles` 返回 `{ slug, originalName, files, displayName }`，让 packager 把映射传给 generateSkillMd
- [x] 16.5 `packageSkill` 在所有 archiveFiles key 前加 `<baseName>/` 前缀（顶层目录嵌套）
- [x] 16.6 单测：含 CJK 的 storyName/worldName/soulName 输入，验证生成的归档结构符合 spec
- [x] 16.7 单测：解压后顶层目录唯一且名字 == frontmatter name
- [x] 16.8 单测：归档内所有文件路径都是纯 ASCII

## 17. SKILL.md 模板同步路径映射

- [x] 17.1 修改 `src/export/skill-template.ts` 的 `SkillTemplateConfig` 接口，加 `characters?: CharacterSpecWithSlug[]` 字段（slug 字段）
- [x] 17.2 `buildMultiCharacterEngine` 中所有 `souls/${c.name}/...` 引用改为 `souls/${c.slug}/...`
- [x] 17.3 `buildSingleCharacterEngine` 同样改 soul path 引用
- [x] 17.4 在 SKILL.md 顶部新增「角色路径映射」段落，列出 `<原始角色名> → souls/<slug>/`，让 LLM 知道映射关系
- [x] 17.5 frontmatter `allowed-tools` 改用空格分隔：`AskUserQuestion Read Write Glob Edit`
- [x] 17.6 单测：snapshot 验证空格分隔 + 路径映射段落 + souls 路径用 slug 而非 name

## 18. Lint 升级：Spec 违规检查 + Formatter 集成

- [x] 18.1 新增 lint 规则 `SKILL_NAME_SPEC`（实现为 packager 内部 isValidSkillName 守卫，formatter 保证生成出的 baseName 永远合规；任何 regression 在 packager 直接 throw）
- [x] 18.2 新增 lint 规则 `ALLOWED_TOOLS_FORMAT`（实现为 skill-template.ts 直接生成空格分隔，无需 lint）
- [x] 18.3 新增 lint 规则 `ARCHIVE_PATH_ASCII`：packager 在写归档前对所有 archive paths 做 ASCII 校验，发现违规直接 throw
- [x] 18.4 lint 报告区分 deterministic 违规（formatter 修复）和 non-deterministic 警告（schema key 拼写等）
- [x] 18.5 packager 集成：format 阶段消除所有 deterministic violations，剩下的才是 lint warnings
- [x] 18.6 单测：lint 抓住 schema_key_naming / yaml_parse / axis_cross_ref 等剩余非 deterministic 违规
- [x] 18.7 单测：经过 formatter 后再 lint，CJK 字段命名违规全部消失（manual fsn 验证 + 自动测试）

## 19. 端到端验证：失败的 fsn 案例

- [x] 19.1 用 explicit 含 CJK 的 storyName / worldName / soulName 调用 packageSkill，验证生成的 .skill 上传不再被 spec 拒绝（test：'packages a skill with CJK soul name and produces ASCII-only archive paths'）
- [x] 19.2 解压验证：顶层目录是 ASCII slug、所有文件路径都是 ASCII、SKILL.md 含路径映射段
- [x] 19.3 frontmatter `name` 通过 `^[a-z0-9]+(-[a-z0-9]+)*$` 检查
- [x] 19.4 `allowed-tools` 是空格分隔
- [ ] 19.5 (manual) 实际把生成的 .skill 上传到 Claude，确认 upload 成功

## 20. 移除 4 角色硬上限

- [x] 20.1 删除 `src/agent/export-agent.ts` 中 `MAX_CHARACTERS = 4` 常量及 ExportBuilder.addCharacter 的强制检查
- [x] 20.2 export agent system prompt 中关于角色数推荐 acts_options 的指导扩展支持 ≥5 个角色
- [x] 20.3 文档说明真正的瓶颈是 prompt size 而非硬常量；大 cast 会自然在 LLM 调用时遇到 context 限制

## 21. LLM 幻觉守则（hallucination guards）

> Hot fix 起因：fsn export 中观察到 export agent 把"伊莉雅 ↔ 凛"虚构为"姐妹分离/愧疚"，
> 而 relationships.md 实际写的是"敌对 Master/竞争对手"。LLM 用 training data 补充了
> 资料中没有的角色关系。系统性 audit 发现 6 处 prompt 缺少 source-only 守则。

- [x] 21.1 `src/agent/export-agent.ts`: 顶部新增「资料使用守则（绝对优先级）」段，明确禁止用 training data 编造关系/设定/背景
- [x] 21.2 `src/agent/export-agent.ts` 任务详解 §1: 删掉"完全无关系数据时基于人格和世界观创意补全"豁免，改为"无关系数据时不要强行配对，错开 acts 出场或诚实标注"
- [x] 21.3 `src/agent/export-agent.ts` 用户意图块 + 工作流块: "可以自主创作"措辞收紧——剧情/场景/tone 措辞可发挥，但角色基本属性必须严格来自 soul 资料
- [x] 21.4 `src/world/distill.ts` Pass A (timeline extractor): 新增 "ONLY list events that appear in the provided articles" 硬规则
- [x] 21.5 `src/world/distill.ts` Pass B (history event writer): 删掉 "and your context about the world" 漏洞，改为只允许 source excerpt + article context
- [x] 21.6 `src/world/distill.ts` Pass C (long-term trends): 新增 "Empty array is the correct answer when source is sparse" 鼓励空返回
- [x] 21.7 `src/world/distill.ts` legacy `extractEntries` (line 908): 补齐 CRITICAL RULES，与 cache-based 路径一致
- [x] 21.8 `src/distill/distill-agent.ts`: 顶部新增 "## CRITICAL: Source-only rule (highest priority)" 段；加强 readRule 措辞
- [x] 21.9 一致性原则：所有 prompt 都明确"宁可少写、宁可空数组，也不要用 training data 补——初始正确性优先于完整性"
- [x] 21.10 验证：bun run build clean + 663/663 tests pass（zero 代码结构变化，纯 prompt 文本调整）
- [ ] 21.11 (manual) 重新跑 fsn export，验证 dynamics_note / tone / constraints 不再出现"姐妹"等编造关系
