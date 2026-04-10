## MODIFIED Requirements

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

## ADDED Requirements

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
