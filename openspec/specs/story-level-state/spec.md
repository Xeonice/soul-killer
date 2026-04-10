# Story-Level State

故事层级 state 系统：在 export 阶段由 export agent 一次性预定义"shared axes（bond + 2 个 story-defined）+ flags 白名单"，Phase 1 LLM 运行时只能引用不能创造。三层结构（共享 axes / 角色特异 axes / flags）解锁跨角色聚合 DSL（all_chars / any_char），并由 Phase -1 六重加载验证强制兜底。

## Requirements

### Requirement: StoryState 数据结构
系统 SHALL 定义 `StoryState` interface，作为 `StoryMetadata` 的子字段，包含两个部分：`shared_axes_custom` 和 `flags`。该结构表达"故事层级的 state 设计"—— 在 export 阶段由 export agent 一次性预定义，Phase 1 LLM 运行时只能引用不能创造。

#### Scenario: StoryState 结构完整性
- **WHEN** 解析一个合法的 StoryState 对象
- **THEN** SHALL 包含 `shared_axes_custom: string[]`（恰好 2 个元素）
- **AND** SHALL 包含 `flags: Array<{ name: string; desc: string; initial: boolean }>`

#### Scenario: shared_axes_custom 数量约束
- **WHEN** `shared_axes_custom` 数组长度不等于 2
- **THEN** `set_story_state` 工具 SHALL 返回 error

### Requirement: 平台固定的 bond 共享 axis
每个通过 story-level-state 机制生成的 script，每个角色的 state schema SHALL 含 `affinity.<char>.bond` 字段。该字段是 **平台级固定**，不在 `shared_axes_custom` 中显式声明，但仍然被视为"共享 axes"的一部分。

#### Scenario: bond 字段存在
- **WHEN** 读取任何合规的 script.yaml 的 state_schema
- **THEN** 每个角色都 SHALL 含 `affinity.<char>.bond` 字段
- **AND** 该字段的 type SHALL 为 `int`
- **AND** range SHALL 为 `[0, 10]`

#### Scenario: bond 不在 shared_axes_custom
- **WHEN** export agent 调用 set_story_state 时传入 `shared_axes_custom: ["bond", "trust"]`
- **THEN** 工具 SHALL 返回 error，拒绝 `bond` 作为自定义 axis（已由平台固定）

### Requirement: 共享 axes 完整性（每个角色 3 个）
每个角色的 state_schema SHALL **必须**含完整的 3 个共享 axes 字段：
- `affinity.<char>.bond`
- `affinity.<char>.<shared_axis_a>`（来自 story_state.shared_axes_custom[0]）
- `affinity.<char>.<shared_axis_b>`（来自 story_state.shared_axes_custom[1]）

**没有 opt-out 选项**。哪怕某个角色剧情上完全不参与亲密度系统，也必须有这三个字段（可以将 initial 设为 0 或负值表达疏远）。

#### Scenario: 所有角色都有完整共享 axes
- **WHEN** Phase 1 LLM 生成 script.yaml 的 state_schema，story_state.shared_axes_custom = `["trust", "rivalry"]`
- **THEN** state_schema 中对每个 character 都 SHALL 含 `affinity.<char>.bond`、`affinity.<char>.trust`、`affinity.<char>.rivalry` 三个字段

#### Scenario: 缺失任一共享 axis
- **WHEN** 某角色的 schema 缺少 `affinity.<char>.trust`（story_state 中声明了但 schema 没写）
- **THEN** Phase -1 加载验证 SHALL 失败
- **AND** SHALL 标该 script 为 `(损坏)`，提供删除入口

### Requirement: 共享 axes initial 可 per-character 覆盖
每个角色的共享 axes `default` 值可由 `set_character_axes` 工具中的 `shared_initial_overrides` 字段覆盖。未覆盖时使用全局默认值（bond=5；story-defined axes 的默认值也是 5）。

#### Scenario: 反派角色初始低亲密度
- **WHEN** 调用 `set_character_axes({ character_name: "葛木", shared_initial_overrides: { bond: 1, trust: 2, rivalry: 7 } })`
- **THEN** 生成的 story_spec.md 中 `affinity.葛木.bond` 的 initial SHALL 为 1
- **AND** `affinity.葛木.trust` 的 initial SHALL 为 2
- **AND** `affinity.葛木.rivalry` 的 initial SHALL 为 7

#### Scenario: 覆盖引用了不存在的 axis
- **WHEN** `shared_initial_overrides` 含 story_state 中未声明的 axis 名（如 `loyalty`，但 shared_axes_custom = `["trust", "rivalry"]`）
- **THEN** `set_character_axes` 工具 SHALL 返回 error `unknown shared axis: loyalty`

### Requirement: 特异 axes 数量 0-2 个
每个角色在 `set_character_axes` 中可以传入 `specific_axes` 数组，长度 0-2。每个特异 axis 含 `name` / `english` / `initial` / `desc` 字段，与当前 CharacterAxis 格式兼容。

#### Scenario: 零特异 axes
- **WHEN** 调用 `set_character_axes({ character_name: "某次要角色", specific_axes: [] })`
- **THEN** 该角色只含 3 个共享 axes，不含任何特异 axis
- **AND** 工具 SHALL 接受该调用

#### Scenario: 两个特异 axes
- **WHEN** 调用 `set_character_axes({ character_name: "伊莉雅", specific_axes: [{ english: "self_worth", ... }, { english: "despair", ... }] })`
- **THEN** 该角色 schema 含 5 个 affinity 字段（3 共享 + 2 特异）

#### Scenario: 超过 2 个特异 axes
- **WHEN** 调用 `set_character_axes({ specific_axes: [{...}, {...}, {...}] })`（3 个）
- **THEN** 工具 SHALL 返回 error `specific_axes must have 0-2 elements`

### Requirement: Flags 故事级预定义
`set_story_state` 工具 SHALL 接受 `flags: Array<{ name, desc, initial }>` 字段。这些 flags 在 export 阶段被预定义，作为 state_schema 中 `flags.<name>` 字段的 **唯一合法集合**。Phase 1 LLM 不能在 script.yaml 中引入 story_state.flags 之外的 flag 名。

#### Scenario: Phase 1 LLM 产出的 flags 集合
- **WHEN** export 阶段 set_story_state 声明了 flags `["met_illya", "truth_revealed", "saber_vanished"]`
- **THEN** Phase 1 LLM 生成的 script.yaml 中 state_schema 的 flags 字段 key 集合 SHALL 严格等于 `{"flags.met_illya", "flags.truth_revealed", "flags.saber_vanished"}`

#### Scenario: Phase 1 LLM 尝试引入新 flag
- **WHEN** Phase 1 LLM 在 consequences 中写 `"flags.some_new_flag": true`，而 story_state.flags 中没有 `some_new_flag`
- **THEN** Phase 1 自检 SHALL 失败
- **AND** LLM SHALL 重写 script 直到所有 flag 引用都在 story_state.flags 白名单内

### Requirement: Flags 集合一致性（Phase -1 加载验证）
Phase -1 加载 script 时，SHALL 验证 `script.state_schema` 中所有 `flags.<name>` 字段的 key 集合（去掉 `flags.` 前缀后的 name 列表）严格等于 `story_spec.flags` 的 name 列表。

#### Scenario: Flags 集合匹配
- **WHEN** script.state_schema 含 `flags.met_illya, flags.truth_revealed, flags.saber_vanished`
- **AND** story_spec.flags = `[{name: "met_illya"}, {name: "truth_revealed"}, {name: "saber_vanished"}]`
- **THEN** 加载验证通过

#### Scenario: Script 缺少 story_spec 中声明的 flag
- **WHEN** story_spec.flags 含 `truth_revealed` 但 script.state_schema 没有 `flags.truth_revealed`
- **THEN** 加载验证失败
- **AND** SHALL 标 script 为 `(损坏)`

#### Scenario: Script 含 story_spec 未声明的 flag
- **WHEN** script.state_schema 含 `flags.mystery_flag` 但 story_spec.flags 没有 `mystery_flag`
- **THEN** 加载验证失败
- **AND** SHALL 标 script 为 `(损坏)`

### Requirement: Endings DSL 新增 all_chars / any_char primitive
Endings condition DSL SHALL 新增两种聚合节点类型：`all_chars` 和 `any_char`，用于跨角色的 ALL / ANY 判定。每个节点包含 `axis: string`、`op: string`、`value: any`、可选 `except: string[]` 字段。

#### Scenario: all_chars 节点评估
- **WHEN** 条件为 `all_chars: { axis: "bond", op: ">=", value: 7 }`
- **AND** state 中所有角色的 `affinity.<char>.bond` 都 ≥ 7
- **THEN** evaluate 返回 true

#### Scenario: all_chars 中有角色不满足
- **WHEN** 条件为 `all_chars: { axis: "bond", op: ">=", value: 7 }`
- **AND** state 中某个角色的 bond = 5
- **THEN** evaluate 返回 false

#### Scenario: any_char 节点评估
- **WHEN** 条件为 `any_char: { axis: "trust", op: ">=", value: 8 }`
- **AND** state 中至少一个角色的 trust ≥ 8
- **THEN** evaluate 返回 true

#### Scenario: except 排除子集
- **WHEN** 条件为 `all_chars: { axis: "bond", op: ">=", value: 7, except: ["葛木"] }`
- **AND** state 中除葛木外所有角色 bond ≥ 7，葛木 bond = 1
- **THEN** evaluate 返回 true（葛木被排除）

### Requirement: 聚合 DSL 只接受共享 axes
`all_chars` 和 `any_char` 节点的 `axis` 字段 SHALL 只接受共享 axes 名（bond 或 shared_axes_custom 中声明的 2 个）。不允许引用角色特异 axes。

#### Scenario: 聚合 DSL 引用共享 axis
- **WHEN** 条件为 `all_chars: { axis: "bond", ... }`
- **THEN** 视为合法

#### Scenario: 聚合 DSL 引用特异 axis
- **WHEN** 条件为 `all_chars: { axis: "self_worth", ... }`（特异 axis，只伊莉雅有）
- **THEN** Phase 1 自检 SHALL 失败（不允许跨角色聚合非共享字段）
- **AND** Phase -1 加载验证 SHALL 失败

### Requirement: Flags 数量 soft cap
`set_story_state` 工具的 prompt 引导 export agent 在 **~8 个以内** 声明 flags，但**不设置硬上限**。超过 8 个只触发 prompt 级的 "too many flags" 警告，不阻塞流程。

#### Scenario: 合理 flags 数量
- **WHEN** export agent 声明 5 个 flags
- **THEN** 工具 SHALL 接受，无警告

#### Scenario: 过多 flags 触发警告
- **WHEN** export agent 声明 12 个 flags
- **THEN** 工具 SHALL 接受（不阻塞）
- **AND** 日志 SHALL 记录 warning `flags count (12) exceeds soft cap (8)`
