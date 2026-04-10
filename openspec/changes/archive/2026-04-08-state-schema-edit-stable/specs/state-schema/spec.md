## ADDED Requirements

### Requirement: state_schema 嵌入 script.yaml
每个 `runtime/scripts/script-<id>.yaml` SHALL 在文件顶部（frontmatter 之后）包含 `state_schema` 块，作为该剧本所有可能跟踪的状态字段的显式契约。Schema 是一个 flat 字典，顶层 key 是字面字符串带引号，没有 affinity/flags/custom 中间嵌套层。

#### Scenario: script.yaml 顶部有 state_schema
- **WHEN** Phase 1 LLM 生成 script.yaml
- **THEN** 文件 frontmatter 之后 SHALL 出现 `state_schema:` 节点
- **AND** 该节点是一个 yaml 字典
- **AND** 字典 key 是带引号的字面字符串

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

#### Scenario: consequences 引用合法字段
- **WHEN** state_schema 含 `"affinity.judy.trust"` 且某个 consequences 写 `"affinity.judy.trust": -2`
- **THEN** 该 consequence 通过验证

#### Scenario: 引用不存在字段
- **WHEN** consequences 写 `"affinity.judy.unknown": -2` 且 schema 中无此 key
- **THEN** Phase 1 自检 SHALL 失败
- **AND** Phase -1 加载验证（抽样阶段）SHALL 失败

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

### Requirement: state.yaml 行格式严格化
存档 `runtime/saves/slot-<N>/state.yaml` SHALL 满足以下行格式约束：
- 第一行 `current_scene: "<scene-id>"`
- 接下来一个 `state:` 行
- 之后每个 schema 字段单独一行，格式严格为 `  "<key>": <value>`（两空格缩进 + 引号 key + 冒号空格 + 值）
- 没有跨行表达式
- 没有 yaml block scalar
- 没有空行间隔

#### Scenario: 标准行格式
- **WHEN** state.yaml 含 `  "affinity.judy.trust": 5`
- **THEN** 该行 SHALL 通过 lint

#### Scenario: 嵌套对象违反格式
- **WHEN** state.yaml 写作 `state:\n  affinity:\n    judy:\n      trust: 5`
- **THEN** 该格式违反约定，加载时 schema 字段集对齐验证将失败

### Requirement: state 更新使用 Edit 工具行级替换
Phase 2 场景流转期间，state.yaml 和 meta.yaml 的更新 SHALL 通过 `Edit` 工具的行级 `old_string` → `new_string` 替换完成。**不允许**使用 `Write` 工具重写整个 state.yaml 或 meta.yaml。

唯一例外（允许使用 Write）：
- Phase 2 第一次进入场景时初始化 state.yaml
- Phase -1「重玩当前剧本」时把 state.yaml 重置到 initial_state

这两次 Write 都是从 schema 全量序列化，不存在"漏字段"风险。

#### Scenario: 场景流转用 Edit
- **WHEN** 玩家选某选项触发 consequences
- **THEN** SKILL.md 指示 LLM 对每个变化字段调一次 `Edit` 工具
- **AND** 每次 Edit 的 `old_string` 是 `'  "<key>": <旧值>'`，`new_string` 是 `'  "<key>": <新值>'`

#### Scenario: 初始化用 Write（一次性）
- **WHEN** Phase 2 第一次进入第一个场景
- **THEN** SKILL.md 指示 LLM 用 Write 写完整 state.yaml（基于 initial_state）
- **AND** 该 Write 操作是允许的

#### Scenario: 重玩重置用 Write（一次性）
- **WHEN** Phase -1 选「重玩当前剧本」
- **THEN** SKILL.md 指示 LLM 用 Write 把 state.yaml 整体覆盖为 initial_state
- **AND** 该 Write 操作是允许的

### Requirement: state 字段集运行时强制对齐 schema
任何时候，state.yaml 的字段集 SHALL 等于对应 script 的 state_schema 字段集（字面字符串相等）。Phase -1 加载存档时验证这个 invariant，不一致 SHALL 弹出修复菜单。

#### Scenario: 对齐通过
- **WHEN** state.yaml 字段集与 script.state_schema 字段集完全相同
- **THEN** 加载流程通过验证

#### Scenario: 缺失字段
- **WHEN** state.yaml 缺少 schema 中的某个字段
- **THEN** SKILL.md 指示 LLM 弹出修复菜单：「缺失字段 → 用 schema.default 补 / 完全重置 / 取消加载」
- **AND** 用户选择"补"时，LLM 用 Write 把 state.yaml 重写为完整字段集

#### Scenario: 多余字段
- **WHEN** state.yaml 含 schema 中没有的字段
- **THEN** 弹修复菜单：「多余字段 → 丢弃 / 完全重置 / 取消加载」

#### Scenario: 类型不符
- **WHEN** state.yaml 中某字段值类型与 schema 类型不匹配（如 int 字段存了字符串）
- **THEN** 弹修复菜单：「类型不符 → 重置该字段为 default / 完全重置 / 取消加载」
