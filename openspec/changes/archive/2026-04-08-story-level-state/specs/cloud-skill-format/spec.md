## MODIFIED Requirements

### Requirement: SKILL.md 引用 state_schema 创作约束

SKILL.md Phase 1 章节 SHALL 包含 state_schema 的命名约束、**三层结构**（共享 axes / 角色特异 axes / flags）、类型集合、字段元信息要求、命名空间约定，作为 LLM 写 schema 时的参考。Phase 1 LLM **必须**严格遵守：

- 每个角色必须有完整的 3 个共享 axes（`bond` + story_state.shared_axes_custom 里的 2 个）
- 每个角色可额外有 0-2 个特异 axes
- `flags.<name>` 字段集合必须等于 story_spec.flags 的 name 列表，**不能增删或改名**

#### Scenario: 命名约束在 Phase 1 章节
- **WHEN** 生成 SKILL.md
- **THEN** Phase 1 章节 SHALL 明确说明 schema key 必须 ASCII / snake_case / dot 分隔 / 带引号

#### Scenario: 三层结构在 Phase 1 章节
- **WHEN** 生成 SKILL.md
- **THEN** Phase 1 章节 SHALL 清晰说明共享 axes 层（bond + 2 story-defined）
- **AND** SHALL 说明角色特异 axes 层（0-2 个/角色）
- **AND** SHALL 说明 flags 层 —— "flags 必须从 story_spec.flags 逐条 copy，不能创造新 flag"

#### Scenario: 类型集合在 Phase 1 章节
- **WHEN** 生成 SKILL.md
- **THEN** Phase 1 章节 SHALL 列出四种合法 type：`int / bool / enum / string`

#### Scenario: 命名空间约定
- **WHEN** 生成 SKILL.md
- **THEN** Phase 1 章节 SHALL 推荐 affinity / flags / custom 三个命名空间前缀
- **AND** 说明系统不解析这些前缀，纯命名约定

### Requirement: SKILL.md 引用 endings DSL 语法

SKILL.md Phase 1 章节 SHALL 包含 endings condition 结构化 DSL 的完整语法说明，**包含跨角色聚合 primitive**。除了现有的比较节点和布尔组合节点外，DSL SHALL 支持 `all_chars` 和 `any_char` 聚合节点。

#### Scenario: DSL 语法在 Phase 1 章节
- **WHEN** 生成 SKILL.md
- **THEN** Phase 1 章节 SHALL 包含至少一个 endings condition 的 DSL 示例
- **AND** SHALL 列出支持的算子 `>= / <= / > / < / == / !=`
- **AND** SHALL 列出支持的逻辑节点 `all_of / any_of / not`
- **AND** SHALL 列出跨角色聚合节点 `all_chars / any_char`，含可选 `except` 字段
- **AND** SHALL 说明 `condition: default` 兜底语义

#### Scenario: 聚合节点 axis 限制
- **WHEN** 生成 SKILL.md
- **THEN** Phase 1 章节 SHALL 明确 `all_chars` / `any_char` 节点的 `axis` 字段只能引用共享 axes（bond 或 story_state.shared_axes_custom 中的 2 个），不能引用角色特异 axes

### Requirement: Phase -1 四重加载验证

SKILL.md Phase -1 章节 SHALL 在加载某个 script 之前对其执行**六重**验证（在 state-schema-edit-stable 的 4 重基础上新增 2 重）：

1. **dangling reference 检查**：meta.yaml.script_ref 指向的 script 文件必须存在；不存在 → 标 (孤儿)
2. **state_schema 完整性**：script.yaml 顶部必须含 state_schema 块；缺失 → 标 (legacy 不可重玩)
3. **initial_state 字段集对齐**：initial_state 字段集必须 == state_schema 字段集；不对齐 → 标 (损坏)
4. **scenes consequences 抽样**：抽样 5 个 scene，每个 consequences key 必须存在于 state_schema；不通过 → 标 (损坏)
5. **共享 axes 完整性** ★ 新增：每个角色必须有完整的 3 个共享 axes（bond + story_state.shared_axes_custom 中的 2 个）；缺失 → 标 (损坏)
6. **flags 集合一致性** ★ 新增：script.state_schema 中所有 `flags.<name>` 字段的 name 集合必须严格等于 story_spec.flags 的 name 列表；不一致 → 标 (损坏)

「继续游戏」额外验证：
7. **state.yaml 字段集对齐**：state.yaml 字段集必须 == state_schema 字段集；不对齐 → 弹「修复菜单」

#### Scenario: dangling 检查
- **WHEN** Phase -1 选择某个存档
- **AND** 该存档的 meta.yaml.script_ref 指向的 script 文件不存在
- **THEN** SKILL.md 指示 LLM 标该存档为 (孤儿)，提供"删除存档"入口

#### Scenario: legacy hard fail
- **WHEN** 用户选择某个 script
- **AND** 该 script.yaml 顶部没有 state_schema 块
- **THEN** SKILL.md 指示 LLM 标该 script 为 (legacy 不可重玩)

#### Scenario: 共享 axes 不完整
- **WHEN** 加载某 script，story_state.shared_axes_custom = ["trust", "rivalry"]
- **AND** 某角色的 state_schema 只含 `affinity.<char>.bond` 和 `affinity.<char>.trust`（缺 rivalry）
- **THEN** 验证 5 失败，标 (损坏)，提供删除入口

#### Scenario: Flags 集合不匹配
- **WHEN** script.state_schema 含 `flags.some_random_flag` 但 story_spec.flags 中没有该 name
- **THEN** 验证 6 失败，标 (损坏)

#### Scenario: 继续游戏 state 字段集修复菜单
- **WHEN** 「继续游戏」时 state.yaml 缺一个 schema 字段
- **THEN** SKILL.md 指示弹出修复菜单
- **AND** 选项包含「补缺失字段为 default」「完全重置」「取消加载」
