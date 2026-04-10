# State Schema

## Purpose

视觉小说剧本状态系统的结构化契约定义，包括 state_schema 嵌入、字段命名约束、类型集合、initial_state 对齐、consequences 语义、endings DSL、state.yaml 行格式与运行时强制对齐规则。
## Requirements
### Requirement: state_schema 嵌入 script.yaml
每个 `runtime/scripts/script-<id>.yaml` SHALL 在文件顶部（frontmatter 之后）包含 `state_schema` 块，作为该剧本所有可能跟踪的状态字段的显式契约。Schema 是一个 flat 字典，顶层 key 是字面字符串带引号，没有 affinity/flags/custom 中间嵌套层。

**story-level-state 新增约束**：state_schema 的结构 SHALL 反映三层设计：

- **共享 axes 层**：对每个角色，必须含 `affinity.<char>.bond` + 2 个 `affinity.<char>.<story_axis>` 字段（story_axis 来自 story_spec.story_state.shared_axes_custom）
- **角色特异 axes 层**：每个角色可额外有 0-2 个 `affinity.<char>.<specific>` 字段
- **Flags 层**：`flags.<name>` 字段集合必须严格等于 `story_spec.story_state.flags` 的 name 列表

#### Scenario: script.yaml 顶部有 state_schema
- **WHEN** Phase 1 LLM 生成 script.yaml
- **THEN** 文件 frontmatter 之后 SHALL 出现 `state_schema:` 节点
- **AND** 该节点是一个 yaml 字典
- **AND** 字典 key 是带引号的字面字符串

#### Scenario: 三层完整性
- **WHEN** 读取一个合规的 state_schema，story_spec.story_state.shared_axes_custom = ["trust", "rivalry"] 且有 3 个角色
- **THEN** state_schema SHALL 至少含 9 个 affinity 字段（3 角色 × 3 共享 axes）
- **AND** 可能含 0-6 个角色特异 axes 字段（每角色 0-2 个）
- **AND** `flags.<name>` 字段集合 SHALL 严格等于 story_spec 声明的 flags

#### Scenario: schema 字典是 flat
- **WHEN** 解析一个合法的 state_schema
- **THEN** 顶层 key SHALL **不** 是 `affinity` / `flags` / `custom` 这种聚合 key
- **AND** 每个 key SHALL 是带命名空间前缀的完整字符串，例如 `"affinity.judy.trust"` 或 `"flags.met_johnny"`

### Requirement: schema 字段命名约束
每个 state_schema key SHALL 满足以下命名规则：
- 全 ASCII 字符（不允许中文、日文、特殊字符）
- snake_case
- 用 `.` 作为命名空间分隔符
- 必须带引号（yaml 字面字符串语法）

命名空间约定（前缀）通常使用 `affinity.<character>.<axis>` / `flags.<name>` / `custom.<name>`，但系统**不解析**这些前缀——它们是给作者和 LLM 看的命名约定，运行时只把整个 key 当字面字符串。

#### Scenario: 合法 key
- **WHEN** schema key 为 `"affinity.judy.trust"`
- **THEN** 该 key SHALL 通过命名约束验证

#### Scenario: 非 ASCII key 拒绝
- **WHEN** schema key 含中文（如 `"亲密度.judy.信任"`）
- **THEN** 该 key SHALL 不通过验证
- **AND** 模板 lint 应当告警

#### Scenario: 缺少引号
- **WHEN** schema key 写作 `affinity.judy.trust:`（无引号）而非 `"affinity.judy.trust":`
- **THEN** 该 schema 视为不合规
- **AND** Phase -1 加载验证 SHALL 失败

### Requirement: schema 字段必含字段元信息
每个 schema 字段 SHALL 是一个对象，必须包含以下子字段：
- `desc: string` — 字段语义说明，**必填**
- `type: 'int' | 'bool' | 'enum' | 'string'` — 字段类型，**必填**
- `default: <value>` — 字段默认值，**必填**，类型必须匹配 `type`

根据 type 还需要含特定子字段：
- `int` → 必含 `range: [min: number, max: number]`
- `enum` → 必含 `values: string[]`

#### Scenario: int 字段完整声明
- **WHEN** 一个 int schema 字段含 `desc / type=int / range / default`
- **THEN** 该字段 SHALL 通过验证

#### Scenario: int 缺 range
- **WHEN** 一个 int 字段缺少 `range` 子字段
- **THEN** 该字段 SHALL 不通过验证

#### Scenario: enum 缺 values
- **WHEN** 一个 enum 字段缺少 `values` 子字段
- **THEN** 该字段 SHALL 不通过验证

#### Scenario: default 类型不符
- **WHEN** 一个 int 字段的 `default` 是字符串
- **THEN** 该字段 SHALL 不通过验证

#### Scenario: enum default 不在 values 内
- **WHEN** 一个 enum 字段的 `values: ["a", "b"]` 但 `default: "c"`
- **THEN** 该字段 SHALL 不通过验证

#### Scenario: 缺 desc
- **WHEN** 一个 schema 字段缺少 `desc` 字段
- **THEN** 该字段 SHALL 不通过验证

### Requirement: 第一版类型集合最小化
state_schema 字段 type SHALL 仅支持 `int / bool / enum / string` 四种值。第一版**不支持** list、float、datetime、nested object 或任何复合类型。

#### Scenario: list 类型被拒绝
- **WHEN** 一个 schema 字段 type 为 `list`
- **THEN** 该字段 SHALL 不通过验证
- **AND** 模板 lint 应当报错

#### Scenario: nested object 被拒绝
- **WHEN** 一个 schema 字段 type 为 `object` 或类似嵌套类型
- **THEN** 该字段 SHALL 不通过验证

### Requirement: initial_state 字段集严格对齐 schema
script.yaml 中的 `initial_state` 字典 key 集合 SHALL 严格等于 `state_schema` 的 key 集合：缺一不可、多一不可。每个字段的初始值类型必须匹配 schema 的 type，对 enum 类型还必须在 values 列表里。

#### Scenario: initial_state 完整对齐
- **WHEN** state_schema 含 5 个字段
- **THEN** initial_state SHALL 含同样的 5 个 key（字面字符串相等）

#### Scenario: initial_state 缺字段
- **WHEN** state_schema 含 `"flags.met_johnny"` 但 initial_state 没有
- **THEN** Phase -1 加载验证 SHALL 失败

#### Scenario: initial_state 多字段
- **WHEN** initial_state 含 `"unknown.field"` 但 state_schema 没有
- **THEN** Phase -1 加载验证 SHALL 失败

### Requirement: consequences key 必须 copy 自 schema
scenes 中所有 `choices[*].consequences` 字典的 key SHALL 是 state_schema 中已声明 key 的字面字符串拷贝。系统按字符串相等比较——大小写敏感、空格敏感、引号风格无关。

**story-level-state 新增约束**：
- `consequences` 中的 `flags.<name>` 引用的 name SHALL 在 story_spec.story_state.flags 列表内
- `consequences` 中的共享 axis 引用（如 `affinity.<char>.bond`）SHALL 使用每个角色都有的共享 axis 字段

#### Scenario: consequences 引用合法字段
- **WHEN** state_schema 含 `"affinity.judy.trust"` 且某个 consequences 写 `"affinity.judy.trust": -2`
- **THEN** 该 consequence 通过验证

#### Scenario: 引用不存在字段
- **WHEN** consequences 写 `"affinity.judy.unknown": -2` 且 schema 中无此 key
- **THEN** Phase 1 自检 SHALL 失败
- **AND** Phase -1 加载验证（抽样阶段）SHALL 失败

#### Scenario: 引用 story_state 白名单外的 flag
- **WHEN** consequences 写 `"flags.mystery_flag": true` 但 story_spec.story_state.flags 没有 `mystery_flag`
- **THEN** Phase 1 自检 SHALL 失败
- **AND** 即使 Phase 1 LLM 把该 flag 加到了 state_schema 中，Phase -1 flags 一致性验证 SHALL 捕获此错误

#### Scenario: 大小写漂移
- **WHEN** schema 中是 `"affinity.judy.trust"` 但 consequences 写 `"Affinity.Judy.Trust"`
- **THEN** 视为引用不存在字段，验证失败

### Requirement: consequences 语义按 type 决定
consequences 中每个 (key, value) 对的语义 SHALL 由 state_schema 中对应字段的 type 决定：
- `int` 字段：value 是**delta**（加法），新值 = 当前值 + value，结果按 schema.range clamp
- `bool` 字段：value 是**绝对覆盖**，新值 = value
- `enum` 字段：value 是**绝对覆盖**，新值 = value（必须在 schema.values 内，否则错误）
- `string` 字段:value 是**绝对覆盖**，新值 = value

#### Scenario: int delta 加法
- **WHEN** schema `"trust"` 是 int range [0,10]，state[trust] = 5，consequences `"trust": -2`
- **THEN** apply 后 state[trust] = 3

#### Scenario: int clamp 上界
- **WHEN** state[trust] = 9, consequences `"trust": +5`
- **THEN** apply 后 state[trust] = 10（clamp 到 range 上界）

#### Scenario: int clamp 下界
- **WHEN** state[trust] = 1, consequences `"trust": -5`
- **THEN** apply 后 state[trust] = 0（clamp 到 range 下界）

#### Scenario: bool 覆盖
- **WHEN** state[met_johnny] = false, consequences `"met_johnny": true`
- **THEN** apply 后 state[met_johnny] = true

#### Scenario: enum 非法值
- **WHEN** schema enum values [`"a", "b"`], consequences 写 `"location": "c"`
- **THEN** apply 流程 SHALL 报错并停止该次场景流转

### Requirement: endings condition 结构化 DSL
endings 数组中每个 ending 的 `condition` 字段 SHALL 是结构化 DSL 节点，**不**接受自然语言字符串表达式。DSL 支持以下节点类型：

- 比较节点：`{ key: string, op: string, value: any }`
  - `op` 取值：`>=` / `<=` / `>` / `<` / `==` / `!=`
- 逻辑组合节点：`{ all_of: [...] }` / `{ any_of: [...] }` / `{ not: {...} }`，可任意嵌套
- 兜底字面：`condition: default`（字符串字面量 `"default"`）

#### Scenario: 比较节点
- **WHEN** condition 为 `{ key: "affinity.judy.trust", op: ">=", value: 7 }`
- **AND** state[trust] = 8
- **THEN** evaluate 返回 true

#### Scenario: all_of 组合
- **WHEN** condition 为 `{ all_of: [ {key:'a', op:'==', value:true}, {key:'b', op:'>=', value:5} ] }`
- **AND** state[a] = true 且 state[b] = 7
- **THEN** evaluate 返回 true

#### Scenario: any_of 组合
- **WHEN** condition 为 `{ any_of: [...] }` 且至少一个子节点为 true
- **THEN** evaluate 返回 true

#### Scenario: not 组合
- **WHEN** condition 为 `{ not: {...} }` 且子节点为 true
- **THEN** evaluate 返回 false

#### Scenario: default 兜底
- **WHEN** condition 为字符串 `"default"`
- **THEN** evaluate 永远返回 true

#### Scenario: 比较算子限制
- **WHEN** 比较节点 op 是 `>=`、`<=`、`>` 或 `<`，但 key 字段类型不是 int
- **THEN** 该 condition 不通过 schema 验证

#### Scenario: == 适用所有类型
- **WHEN** 比较节点 op 是 `==`，key 是 bool/enum/string/int
- **THEN** 通过验证

#### Scenario: 引用不存在字段
- **WHEN** 比较节点的 key 不在 state_schema 中
- **THEN** Phase 1 自检 / Phase -1 加载验证 SHALL 失败

### Requirement: ending 默认兜底
endings 数组的**最后一个** ending SHALL 含 `condition: default` 字面，作为无条件兜底。这保证任何 state 组合都能匹配到至少一个结局。

#### Scenario: 缺默认兜底
- **WHEN** endings 数组没有任何一个 condition 为 `"default"` 字面
- **THEN** 该 script 视为不合规，Phase -1 加载验证 SHALL 失败

#### Scenario: 默认兜底不在末尾
- **WHEN** 默认兜底 ending 出现在数组中间，后面还有其他 ending
- **THEN** 视为不合规（顺序错误，永远到达不了后面的 ending）

### Requirement: state 更新使用 Edit 工具行级替换
Phase 2 场景流转期间，`state.yaml` 和 `meta.yaml` 的更新 SHALL 通过 `runtime/bin/state` wrapper 调用 bun 脚本完成，**不再**使用 `Edit` 工具行级替换或 `Write` 工具全量重写。LLM SHALL NOT 直接 Read-then-Edit 或 Read-then-Write `state.yaml` / `meta.yaml` 任一文件。

允许的写入路径（全部通过 `bash runtime/bin/state <subcommand>`）：

- `state init <slot> <script-id>`：Phase 2 首次进入场景时从 `initial_state` 初始化
- `state apply <slot> <scene-id> <choice-id>`：场景流转时的事务性状态转移
- `state reset <slot>`：Phase -1「重玩当前剧本」时把存档重置到 `initial_state`
- `state rebuild <slot>`：修复菜单用于从 `initial_state` 重建 `state.yaml`（例如缺字段时）

所有写入 SHALL 使用 temp-file + `rename` 的原子替换语义，`state.yaml` 和 `meta.yaml` 作为一个事务单元，要么都更新成功，要么都不变。

#### Scenario: 场景流转用 state apply
- **WHEN** 玩家选某选项触发 consequences
- **THEN** SKILL.md 指示 LLM 调用 `bash runtime/bin/state apply <slot> <scene-id> <choice-id>`
- **AND** 脚本内部从 script.json 读取 consequences 自行计算 delta
- **AND** 写入 state.yaml 和 meta.yaml
- **AND** LLM SHALL NOT 在这次流转中调用 Edit 或 Write

#### Scenario: 初始化用 state init
- **WHEN** Phase 2 第一次进入第一个场景
- **THEN** SKILL.md 指示 LLM 调用 `bash runtime/bin/state init <slot> <script-id>`
- **AND** 脚本内部从 script.initial_state 一次性写完整 state.yaml
- **AND** 同时写 meta.yaml

#### Scenario: 重玩重置用 state reset
- **WHEN** Phase -1 选「重玩当前剧本」
- **THEN** SKILL.md 指示 LLM 调用 `bash runtime/bin/state reset <slot>`
- **AND** 脚本内部把 state.yaml 重置为 initial_state
- **AND** 脚本内部把 meta.yaml.current_scene 重置为 scenes[0].id

#### Scenario: 禁止直接 Edit / Write
- **WHEN** Phase 2 或 Phase -1 的任何阶段
- **THEN** SKILL.md SHALL 明示 LLM 不得用 Edit 或 Write 直接修改 state.yaml 或 meta.yaml
- **AND** 任何对这两个文件的修改 SHALL 通过 state wrapper 命令进行

#### Scenario: 事务性保证
- **WHEN** `state apply` 需要同时写 state.yaml 和 meta.yaml
- **THEN** 脚本 SHALL 先写临时文件
- **AND** 再用 fs.rename 原子替换两个目标文件
- **AND** 若中途 crash，两个目标文件 SHALL 保持 crash 前的旧内容

### Requirement: state 字段集运行时强制对齐 schema
任何时候，state.yaml 的字段集 SHALL 等于对应 script 的 state_schema 字段集（字面字符串相等）。Phase -1 加载存档时通过 `bash runtime/bin/state validate <slot>` 验证这个 invariant，不一致 SHALL 返回诊断 JSON，LLM 根据诊断弹出修复菜单。

修复动作 SHALL 通过以下脚本命令完成（LLM 不直接编辑文件）：

- 补缺失字段为 default → 调用 `state rebuild <slot>`（从 schema 重建）
- 完全重置 → 调用 `state reset <slot>`
- 取消加载 → 返回存档列表

#### Scenario: 对齐通过
- **WHEN** state.yaml 字段集与 script.state_schema 字段集完全相同
- **THEN** `state validate` 返回 `{"ok": true, "errors": []}`
- **AND** 加载流程继续

#### Scenario: 缺失字段
- **WHEN** state.yaml 缺少 schema 中的某个字段
- **THEN** `state validate` 返回 `errors` 含 `code: FIELD_MISSING`
- **AND** SKILL.md 指示 LLM 弹出修复菜单
- **AND** 用户选择"补"时，LLM 调用 `state rebuild <slot>`

#### Scenario: 多余字段
- **WHEN** state.yaml 含 schema 中没有的字段
- **THEN** `state validate` 返回 `errors` 含 `code: FIELD_EXTRA`
- **AND** SKILL.md 指示 LLM 弹出修复菜单（丢弃多余 / 完全重置 / 取消）

#### Scenario: 类型不符
- **WHEN** state.yaml 中某字段值类型与 schema 类型不匹配（如 int 字段存了字符串）
- **THEN** `state validate` 返回 `errors` 含 `code: FIELD_TYPE_MISMATCH`
- **AND** SKILL.md 指示 LLM 弹出修复菜单

### Requirement: 共享 axes 字段完整性 invariant
系统 SHALL 在多个阶段保证"每个角色都含完整的 3 个共享 axes 字段"这个 invariant：

- **生成时**（Phase 1 LLM）：写 state_schema 时必须为每个 character 生成 3 个 `affinity.<char>.<shared_axis>` 字段，且 shared_axis 列表恰好是 `["bond", ...story_state.shared_axes_custom]`
- **加载时**（Phase -1 验证 5）：从 state_schema 提取每个角色的 axes，与 story_state 对比，缺失立刻标 (损坏)
- **Lint 时**（模板 lint）：SKILL.md 模板中的 yaml 示例必须展示完整的 3 个共享 axes，不允许示例中缺字段

#### Scenario: Phase 1 生成时保证完整性
- **WHEN** Phase 1 LLM 处理 story_state.shared_axes_custom = ["trust", "rivalry"] 和 3 个角色
- **THEN** 生成的 state_schema SHALL 含 9 个形如 `"affinity.<char>.<axis>"` 的字段，axis ∈ {bond, trust, rivalry}
- **AND** Phase 1 自检发现缺失时 SHALL 重写

#### Scenario: 加载时验证完整性
- **WHEN** Phase -1 加载一个共享 axes 不完整的 script
- **THEN** 验证 5 失败，标 (损坏)

### Requirement: 聚合 DSL evaluate 算法
Endings condition 中的 `all_chars` 和 `any_char` 节点 SHALL 按以下算法求值：

```
evaluate(all_chars_node, state, schema, characters):
  included = characters - (node.except or [])
  for char in included:
    key = `affinity.${char}.${node.axis}`
    if schema[key] is None:
      return false                            # 合规 script 不会走到这里
    current = state[key]
    if not apply_op(current, node.op, node.value):
      return false
  return true

evaluate(any_char_node, state, schema, characters):
  included = characters - (node.except or [])
  for char in included:
    key = `affinity.${char}.${node.axis}`
    if schema[key] is None:
      continue
    current = state[key]
    if apply_op(current, node.op, node.value):
      return true
  return false
```

Phase 2 LLM 在触发结局时，SHALL 严格按此算法评估每个 ending 的 condition，第一个 `evaluate` 为 true 的 ending 触发。

#### Scenario: all_chars 全体满足
- **WHEN** 条件 `all_chars: { axis: "bond", op: ">=", value: 7 }`，所有角色 bond 都 ≥ 7
- **THEN** evaluate 返回 true

#### Scenario: any_char 至少一个满足
- **WHEN** 条件 `any_char: { axis: "trust", op: ">=", value: 9 }`，角色 A trust = 9，其他角色 trust < 9
- **THEN** evaluate 返回 true

#### Scenario: except 排除后仍有角色不满足
- **WHEN** 条件 `all_chars: { axis: "bond", op: ">=", value: 7, except: ["葛木"] }`
- **AND** 伊莉雅 bond = 8，凛 bond = 6，Saber bond = 7，葛木 bond = 1
- **THEN** evaluate 返回 false（凛 < 7，不被 except 覆盖）

