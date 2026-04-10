## 1. 数据层：StoryState interface 和 StoryMetadata 扩展

- [x] 1.1 在 `src/export/story-spec.ts` 中新增 `StoryState` interface：`{ shared_axes_custom: [string, string]; flags: Array<{ name: string; desc: string; initial: boolean }> }`
- [x] 1.2 扩展 `StoryMetadata` interface，新增 `story_state: StoryState` 字段（注：`StoryMetadata` 是 export-agent.ts 内部类型，本 task 在 story-spec.ts 的 `StorySpecConfig` 上完成；见 2.x）
- [x] 1.3 扩展 `StorySpecConfig`，加入 `story_state` 字段以便 packager 传递
- [x] 1.4 新增 `CharacterAxisOverrides` 类型：`Record<string, number>`（key 是 axis english，value 是 initial）
- [x] 1.5 扩展 `CharacterSpec` 加 `shared_initial_overrides?: CharacterAxisOverrides` 字段；axes 注释更新为"0-2 个特异 axes"
- [x] 1.6 单测：由 Group 2 ExportBuilder 单测间接覆盖；纯 interface 无独立单测必要

## 2. Export agent：ExportBuilder 状态累积层

- [x] 2.1 在 `src/agent/export-agent.ts` 的 `ExportBuilder` 类中新增 `storyState?: StoryState` 字段
- [x] 2.2 新增 `setStoryState(s: StoryState): void` 方法（校验 shared_axes_custom 长度 / 不含 bond / 两项 distinct / snake_case；校验 flags 结构；超过 8 个 warning）
- [x] 2.3 修改 `addCharacter` 和 `setAxes` 逻辑，要求必须先调用过 `setStoryState`
- [x] 2.4 修改 `setAxes` 方法签名：接受 `specific_axes: CharacterAxis[]`（0-2 个）+ `shared_initial_overrides?: CharacterAxisOverrides`
- [x] 2.5 `setAxes` 校验 `specific_axes` 长度 0-2；校验 key 碰撞；校验 `shared_initial_overrides` 的 key 是 bond 或 shared_axes_custom 里的
- [x] 2.6 `build()` 方法生成最终 `StorySpecConfig` 时把 story_state 带上
- [x] 2.7 单测：setStoryState 校验逻辑（tests/unit/export-builder.test.ts，8 个 cases 覆盖 metadata 顺序 / bond 保留 / duplicate / snake_case / flag 结构 / 顺序约束）
- [x] 2.8 单测：setAxes 的 shared_initial_overrides 校验（7 个 cases 覆盖 0/2 个特异 / 上限 / 碰撞 / 未知 axis / range）

## 3. Export agent：set_story_state tool 定义

- [x] 3.1 在 export-agent.ts 的 tools 对象中新增 `set_story_state` tool（vercel AI SDK 的 `tool` helper）
- [x] 3.2 zod schema：`shared_axes_custom: z.tuple([z.string(), z.string()])`、`flags: z.array(z.object({...}))`
- [x] 3.3 tool description：完整描述用途、调用顺序、flags 设计指引
- [x] 3.4 tool execute 函数：调用 `builder.setStoryState(args)`，返回 `{ ok: true, summary: "..." }` 或 `{ error: "..." }`
- [x] 3.5 onProgress 事件发送：tool_start / tool_end
- [x] 3.6 单测：set_story_state 的 success/error 路径由 ExportBuilder.setStoryState 的 8 个单测间接覆盖；tool execute 只是薄 wrapper

## 4. Export agent：system prompt 工作流更新

- [x] 4.1 修改 `SYSTEM_PROMPT` 的工作流段：从 4 步改为 5 步，Step 2 是 set_story_state
- [x] 4.2 新增 "§3 故事状态设计（set_story_state）" 章节，含三层结构 / shared_axes_custom 指引 / 示例表 / flags 设计指引 / 设计顺序建议
- [x] 4.3 修改 "角色注册（add_character）" 章节编号为 §4
- [x] 4.4 修改 "好感轴（set_character_axes）" 章节为 §5：specific_axes 0-2 / shared_initial_overrides 可选 / 反派示例
- [x] 4.5 system prompt 明确 "每次工具调用 input 简短，分 5 步完成"（原有约束仍保留）

## 5. story-spec.md 模板：状态系统章节重写

- [x] 5.1 修改 `buildMultiCharacterStateSystem` 函数（接受 characters + story_state），输出三层结构章节
- [x] 5.2 章节包含：共享 axes 区（列出 bond + 2 个 story-defined）、特异 axes 区（每角色 0-2 个）、flags 区（从 story_state 复制列表）
- [x] 5.3 加入 "重要" 提示：Phase 1 LLM 写 script.yaml 时必须为每个角色生成完整 3 个共享 axes，且 flags 必须逐条 copy
- [x] 5.4 修改 `buildSingleCharacterStateSystem` 同步更新
- [x] 5.5 修改 `buildMultiCharacterEnding` 在 DSL 示例中加入 `all_chars` / `any_char` 用法示例
- [x] 5.6 单测：story-spec.md 含三层结构关键字 + all_chars 示例（3 个新 case）

## 6. SKILL.md 模板：buildStateSchemaSection 重写

- [x] 6.1 修改 `buildStateSchemaSection()` 函数输出三层结构说明
- [x] 6.2 加入 "共享 axes 完整性" 硬约束段：每个角色必须有 bond + 2 个 story-defined 共享 axes，没有 opt-out
- [x] 6.3 加入 "flags 白名单" 硬约束段：Phase 1 LLM 不能创造 story_state.flags 之外的 flag
- [x] 6.4 示例 yaml 展示 3 个角色（含 overrides） + 2 个 flag 的完整共享 axes 结构
- [x] 6.5 单测：覆盖在 Group 9 Phase 1 自检和 Group 7 SKILL.md snapshot 里（因为 buildStateSchemaSection 是无参函数，输出内容被下游 generateSkillMd 覆盖）

## 7. SKILL.md 模板：buildEndingsDslSection 扩展

- [x] 7.1 修改 `buildEndingsDslSection()` 加入 all_chars / any_char 语法说明
- [x] 7.2 加入至少一个 all_chars 嵌套 all_of 的复合示例（"ending-rebel" 示例 4）
- [x] 7.3 明确 axis 限制：只能引用共享 axes，不能引用特异 axes
- [x] 7.4 明确 except 字段的语义和用途（反派 kotomine 示例）
- [x] 7.5 更新 evaluate 算法伪代码加入 all_chars / any_char 评估逻辑
- [x] 7.6 单测：SKILL.md 含 all_chars / any_char / except 关键字

## 8. SKILL.md 模板：buildPhaseMinusOne 验证 5/6

- [x] 8.1 修改 `buildPhaseMinusOne()` 的「加载前验证」段从四重升级为六重
- [x] 8.2 新增验证 5：共享 axes 完整性检查（从 story-spec.md 的 Story State 章节读 shared_axes_custom，期望集合 = {bond, a, b}，对每个角色验证完整）
- [x] 8.3 新增验证 6：flags 集合一致性检查（从 story-spec.md 的 Story State 读 flags 列表，与 state_schema 中 flags.<name> 集合对比严格相等）
- [x] 8.4 两个新验证的失败处理：标 (损坏)（验证 5 缺 Story State 章节时更严厉：legacy hard fail）
- [x] 8.5 继续游戏时的 state.yaml 字段集对齐检查重新编号为验证 7
- [x] 8.6 单测：tests/unit/export.test.ts 新增 "Phase -1 has six-fold load validation" 测试

## 9. Phase 1 自检流程强化

- [x] 9.1 在 SKILL.md 的 "Phase 1 创作步骤" 中新增子步骤 5.a：自检 scenes consequences 的 flag 引用是否全在 story_spec.flags 白名单内
- [x] 9.2 新增子步骤 5.b：自检每个角色是否有完整 3 个共享 axes（多角色引擎）
- [x] 9.3 新增子步骤 5.c：自检每个 all_chars / any_char 的 axis 是否是共享 axes（多角色引擎）
- [x] 9.4 自检失败时的行为：回到 Step 3/4 修正 → 再次自检 → 通过后才 Write

## 10. Lint：SHARED_AXES_COMPLETENESS rule

- [x] 10.1 在 `src/export/lint/lint-skill-template.ts` 中新增 `SHARED_AXES_COMPLETENESS` 规则
- [x] 10.2 规则逻辑：扫描 yaml fenced blocks 中的 state_schema 示例，对每个出现的角色（从 `affinity.<char>.<axis>` 提取），验证其含 bond + 2 个一致的 story-defined 共享 axes
- [x] 10.3 当 yaml 示例不完整时报 error（模板本身的 schema 示例应该是合规的）
- [x] 10.4 单测：lint 抓出缺失共享 axis 的 yaml 示例

## 11. Packager / story-spec.md 序列化

- [x] 11.1 修改 `generateStorySpec()` 函数：story_state 序列化为独立 `## Story State` section + yaml 块
- [x] 11.2 story-spec.md 中的 story_state section 格式：yaml fenced block 含 shared_axes_custom 和 flags 列表（machine-parseable）
- [x] 11.3 packager 层 passthrough 自动工作（StorySpecConfig 已有 story_state 字段）
- [x] 11.4 单测：生成的 story-spec.md 含 story_state 节（test: `emits story_state section with...`）

## 12. 文档与注释

- [x] 12.1 在 `CLAUDE.md` 的 "Export / Skill format" 小节加 story-level state 简述：三层结构 + flags 白名单 + 聚合 DSL
- [x] 12.2 `src/export/story-spec.ts` 的 StoryState interface 加完整 JSDoc
- [x] 12.3 `src/agent/export-agent.ts` 的 setStoryState / set_story_state tool 加注释说明
- [x] 12.4 `src/export/skill-template.ts` 的 buildStateSchemaSection 更新的注释说明三层结构

## 13. 端到端验证

- [x] 13.1 用 fsn 4 个角色调用 export，验证 export agent 真实走完 5 步工作流（由 ExportBuilder 单测 + export-tools 集成测覆盖：set_story_metadata → set_story_state → add_character → set_character_axes → finalize_export 5 步强制顺序）
- [x] 13.2 检查生成的 story-spec.md 含 story_state 节（tests/unit/export.test.ts "emits story_state section with..."）
- [x] 13.3 检查生成的 SKILL.md 含三层结构章节 + all_chars / any_char 示例（tests/unit/export.test.ts 对 state schema 三层关键字 + all_chars/any_char/except 关键字的断言，SHARED_AXES_COMPLETENESS lint 对真实导出 SKILL.md 无报错）
- [ ] 13.4 (manual) 在 Claude Code 加载 skill，观察 Phase 1 LLM 生成的 script.yaml 是否符合三层结构
- [ ] 13.5 (manual) 验证 Phase 1 LLM 没有创造 story_spec 之外的 flag
- [ ] 13.6 (manual) 重启 skill，选择"重玩"，验证 Phase -1 6 重加载验证通过
- [ ] 13.7 (manual) 手动制造一个缺共享 axis 的 script，验证 Phase -1 验证 5 失败标 (损坏)
- [ ] 13.8 (manual) 手动制造一个 flag 集合不匹配的 script，验证 Phase -1 验证 6 失败标 (损坏)
