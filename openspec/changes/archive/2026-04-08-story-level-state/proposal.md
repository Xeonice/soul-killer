## Why

`state-schema-edit-stable` 让每个 script 有了显式的 state_schema 块，但 state 的**设计权**仍然在 Phase 1 LLM 手里——运行时自由命名 flags、每个角色自由发挥 axes。这导致两个真实痛点：

**痛点 1：跨角色对比不可能**

作者想写"所有角色都接纳主角的结局"这种条件，但每个角色的 axes 名字都不一样：
- 伊莉雅有 `bond / trust / self_worth`
- 凛有 `affection / understanding / rationality`
- Saber 有 `bond / honor`
- 葛木有 `opposition`

根本没有共享维度可以聚合。想写 "所有角色 bond >= 7" 必须分别引用 4 个不同 key，且其中半数角色的 "亲密度" 根本不叫 bond。ending DSL 能做的跨角色判定等于零。

**痛点 2：Flags 是运行时发明，作者不掌控**

关键事件标记（`illya_acknowledges_sisterhood`、`truth_of_grail_revealed`）是 Phase 1 LLM 在创作剧本时临时命名的。作者在设计故事整体弧线时没有地方预先声明"这个故事需要跟踪哪些关键节点"。结果：
- 跨 script 命名漂移（同一个 skill 重新生成 script 后 flag 名可能变）
- Ending condition 的 flag 引用完全依赖 Phase 1 LLM 的创作选择
- 作者无法在 design-time 写"这个故事的主线结局触发条件是什么"

**设计哲学的根本冲突**：state 应该在**故事整体设计阶段**就规划好（哪些 flag 触发主线、哪些维度跨角色可比较），而不是每个角色的 LLM 自由发挥 + Phase 1 LLM 临时编造。当前设计偏向"叙事自由"，但我们需要的是"状态机纪律"。

## What Changes

- **引入三层 state 结构**：共享 axes + 角色特异 axes + flags，所有三层都在 export 阶段**设计时定义**，Phase 1 LLM 只能在其中填值
- **共享 axes（跨角色基础）**：每个角色都必须有 3 个共享 axes 字段
  - `bond` — 平台固定（所有 soulkiller 故事共用）
  - 另外 2 个由 export agent 在新工具 `set_story_state` 中定义（故事级定制）
  - 每个角色可以在 `set_character_axes` 时覆盖共享 axes 的初始值（反派初始 `bond` 可以是 1 而非 5）
- **角色特异 axes**：每个角色额外 0-2 个特异 axis（如伊莉雅的 `self_worth`），纯 flavor 但仍可进 ending condition
- **Flags（故事级预定义）**：export agent 在 `set_story_state` 时**一次性声明**所有关键事件标记（soft cap ~8 个），含 name + desc + initial。Phase 1 LLM **不能**创造新 flag
- **新工具 `set_story_state`**：export agent 工作流从 4 步扩展为 5 步，在 set_story_metadata 之后、add_character 之前调用
- **新 DSL primitive**：endings condition 支持 `all_chars` 和 `any_char` 聚合节点，用于 ALL/ANY 跨角色判定，可选 `except` 排除子集
- **Phase -1 加载验证强化**：新增两个 invariant 检查
  - 共享 axes 完整性：每个角色必须含 bond + 2 个 story-defined 共享 axes
  - Flags 集合一致性：state_schema.flags 集合必须等于 story_spec.flags 列表
- **Phase 1 创作约束强化**：LLM 在写 script.yaml 的 state_schema 时，flags 必须**逐条 copy** story_spec 中的声明，不允许增删或改名
- **数据层扩展**：`StoryMetadata` interface 新增 `story_state` 字段（shared_axes_custom + flags）；`CharacterAxis` 语义调整为"特异 axis 声明"；新增 `CharacterAxisOverrides` 表达共享 axis 的 initial 覆盖
- **BREAKING** 旧 script（没有 story_state block 或缺少共享 axes）→ hard fail，标 legacy 不可重玩
- **模板 lint 增强**：新增 `SHARED_AXES_COMPLETENESS` 规则，检查 SKILL.md 模板中的 schema 示例是否每个角色都声明了完整的 3 个共享 axes

## Capabilities

### New Capabilities
- `story-level-state`: 故事层级的统一状态设计 —— 三层 state 结构（共享 axes / 角色特异 axes / flags）、设计时定义而非运行时发明、跨角色聚合 DSL primitive

### Modified Capabilities
- `cloud-skill-format`: SKILL.md 的 state_schema 创作约束章节需要描述新的三层结构；endings DSL 章节需要加 all_chars/any_char primitive；Phase -1 加载验证新增 2 项；Phase 1 创作步骤加入 "从 story_spec 复制 flags 列表" 硬规则
- `state-schema`: state_schema 块的 Required 规则调整 —— 共享 axes 字段集必须完整，flags 字段集必须匹配 story_spec

## Impact

**代码改动**：
- `src/export/story-spec.ts` — `StoryMetadata` / `StorySpecConfig` interface 扩展；状态系统章节模板重写（三层结构）；结局判定章节加 all_chars/any_char 说明
- `src/agent/export-agent.ts` — 新增 `set_story_state` tool；`ExportBuilder` 加 `setStoryState` 方法；system prompt 工作流更新为 5 步；加入 "shared axes 设计指引" 和 "flags 设计指引" 段
- `src/export/skill-template.ts` — `buildStateSchemaSection` 重写描述三层结构和完整性要求；`buildEndingsDslSection` 新增 all_chars/any_char 语法；`buildPhaseMinusOne` 加入共享 axes 完整性 + flags 一致性验证步骤
- `src/export/lint/lint-skill-template.ts` — 新增 `SHARED_AXES_COMPLETENESS` 规则
- `src/export/packager.ts` — `StorySpecConfig` 变化可能触发 interface 传递调整

**Skill 运行时**：
- 玩家端零新增依赖（沿用 state-schema-edit-stable 的跨平台设计）
- Phase 1 LLM 需要更严格地遵守 schema 约束（会在 prompt 里明确传达）
- Phase 2 场景流转不变（仍然用 Edit 工具行级更新 state.yaml）

**对已导出 skill 的影响**：
- 旧 skill（没有 story_state 块）运行时仍按旧规则跑，不受影响
- 用旧 skill 生成的 script 在新 SKILL.md 模板下加载会被标为 legacy（hard fail）
- 跨版本存档不迁移，与 state-schema-edit-stable 的策略一致

**对作者体验**：
- Export agent 工作流多 1 步（set_story_state），需要思考故事级 state 设计
- 换来的是 ending condition 可以干净地表达跨角色判定
- 多角色故事的结局设计从"查每个角色的 axes 表"变成"用统一语义写条件"

**跟 state-schema-edit-stable 的关系**：
- 建立在 state-schema-edit-stable 的基础上（需要先 archive 它）
- 本 change 改的是 state 的**设计时语义**，state-schema-edit-stable 改的是 state 的**运行时存储**
- 两个 change 的 invariant 叠加：Phase -1 加载时现在有 6 重验证（原 4 重 + 共享 axes 完整性 + flags 一致性）
