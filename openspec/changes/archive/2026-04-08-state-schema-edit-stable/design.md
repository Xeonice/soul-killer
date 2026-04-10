## Context

`script-persistence` change 已经把剧本和存档落到磁盘，但运行时状态的更新机制留下两个问题：

1. **state.yaml 由 LLM read-modify-write**：每次场景流转 LLM 都要 Read 整个 state，在内部更新，再 Write 整个 state 回去。这一步重写是漂移的源头——LLM 可能漏行、错引号、改字段顺序。
2. **schema 是隐式的**：affinity 轴名来自 `CharacterSpec.axes`，flags 由 LLM 在 Phase 1 自由命名，没有 single source of truth。consequences 引用的 key 跟 LLM 自己写出的字段命名可能漂移。

我们在 explore 阶段确认了一个关键事实：**LLM 读字面字符串是稳定的**，漂移只发生在它**写新内容**时（Phase 1 写 scenes）和**重写整个文件**时（Phase 2 写 state.yaml）。所以方案分两条线：
- **写新内容时**：用显式 schema 锁定字段集，配合 Phase 1 LLM 自检
- **重写整个文件时**：彻底取消，改用 Edit 工具行级替换

相关代码：
- `src/export/skill-template.ts` — SKILL.md 模板生成（5 phase 流程）
- `src/export/story-spec.ts` — story-spec.md 生成（characters、状态系统、结局判定）
- `src/export/packager.ts` — `.skill` 归档打包

## Goals / Non-Goals

**Goals:**
- 重玩剧本的状态更新行为完全可复现（同一份 script + 同一份 state → 同一个新 state）
- Phase 1 LLM 创作时显式声明全部状态字段，无隐式发明
- consequences 引用的字段都能机械验证存在性
- endings 判定条件能机械求值（不依赖 LLM 语义解释）
- state.yaml 更新永远不重写整个文件
- 所有改动跨平台，玩家端零新增依赖
- 作者侧有轻量 lint 提前发现 SKILL.md 模板里的字段命名笔误
- 旧 skill 不向后兼容，干净切换

**Non-Goals:**
- 不引入 list/float/datetime/nested 字段类型（第一版只支持 int/bool/enum/string）
- 不做玩家端代码 validator（不引入 Bash/node/bun 依赖）
- 不做 CLI `soulkiller skill verify` 命令（记为未来想法）
- 不做 schema 演进 / 跨剧本迁移（每个 script 是独立故事）
- 不做时间过滤（hard-time clock，属 chronicle follow-up）
- 不做存档 slot 数量动态化（仍固定 3 个）

## Decisions

### Decision 1: schema key 是 flat 字面字符串带引号

**选择**：
```yaml
state_schema:
  "affinity.judy.trust": { ... }
  "flags.met_johnny": { ... }
  "custom.location": { ... }
```

而非：
```yaml
state_schema:
  affinity:
    judy:
      trust: { ... }
  flags:
    met_johnny: { ... }
```

**理由**：
- 嵌套对象需要 LLM 在 yaml 字面与 dot-path 之间做"路径解析"——这个解析动作正是漂移的源头
- flat 字面字符串字典消除路径解析：LLM 看到 `"affinity.judy.trust"` 就是一个字符串，不需要拆解
- state.yaml 与 schema 一一对齐，消除两边对应的歧义
- consequences、endings condition 都引用同一份字面 key，整条链路是字符串相等比较

**代价**：
- yaml 看起来不那么"自然"（一堆带引号的 key）
- 但换来的是字面对齐的稳定性

**命名约束**：
- snake_case
- dot 分隔命名空间
- 全 ASCII，不允许中文/特殊字符
- 命名空间约定（前缀）：`affinity.<character>.<axis>` / `flags.<name>` / `custom.<name>`，但**系统不解析这个前缀**——它只是给作者/LLM 看的命名约定

### Decision 2: 类型集合最小化

第一版只支持 4 种类型：

| type | consequences 语义 | 验证规则 |
|------|------|----------|
| `int` | delta（加法） | 必须含 `range: [min, max]`，超出 clamp |
| `bool` | 绝对覆盖 | value 必须是 true/false |
| `enum` | 绝对覆盖 | 必须含 `values: [...]`，value 必须在列表内 |
| `string` | 绝对覆盖 | value 必须是字符串 |

**不做**：
- list（inventory 之类需求晚一步做）
- float（int 足够覆盖大部分数值轴）
- datetime（chronicle 的时间字段是数值 sort_key，不是 datetime）
- nested object（违背 flat 设计）
- 引用其他字段的复合类型（YAGNI）

**desc 字段必填**——它是 LLM 在 Phase 1 写 scenes 时的语义锚点，省略会让"为什么要改这个字段"失去依据。

### Decision 3: state.yaml 用 Edit 行级替换，不用 Write 重写

**state.yaml 行格式**：
```yaml
current_scene: "scene-005"
state:
  "affinity.judy.trust": 5
  "affinity.judy.attraction": 3
  "affinity.johnny.bond": 5
  "flags.met_johnny": false
  "flags.accepted_arasaka": false
  "custom.location": "watson"
  "custom.relic_corruption": 0
```

每个字段一行，格式严格为 `"<key>": <value>`，没有跨行表达式，没有 yaml block scalar。

**更新规则**（SKILL.md 里给 LLM 的指令）：
```
对每个变化的字段：
  Edit state.yaml:
    old_string: '"<key>": <旧值>'
    new_string: '"<key>": <新值>'
```

**Write 仅用于**：
- Phase 2 第一次进入场景时初始化 state.yaml（一次性写完整文件）
- Phase -1「重玩当前剧本」重置 state.yaml 到 initial_state（一次性写完整文件）

这两次 Write 都是把 schema 的全部字段一次性序列化，没有"漏字段"的可能（schema 是 source of truth）。

**为什么 Edit 是核心**：
- LLM 用 Edit 时只产生"找一行 → 替换一行"的精确动作
- 不重写整个文件 → 不可能漏字段、不可能改顺序、不可能改 yaml 格式
- 这比任何 prompt 自检都可靠——它从源头消除了漂移空间

**SKILL.md 必须追加 Edit 工具到 `allowed-tools`**：
```
allowed-tools: AskUserQuestion, Read, Write, Glob, Edit
```

### Decision 4: consequences 是 delta 字典，按 type 决定语义

```yaml
choices:
  - text: "接受荒坂"
    consequences:
      "affinity.judy.trust": -2          # int → state[key] = state[key] + (-2)
      "affinity.judy.attraction": -1
      "flags.accepted_arasaka": true     # bool → state[key] = true
      "custom.location": "watson"        # enum → state[key] = "watson"
    next: "scene-006"
```

**LLM apply 流程（SKILL.md 里给的伪代码）**：
```
for (key, value) in choice.consequences:
  schema = state_schema[key]
  if schema is None:
    错误: "consequences 引用了未声明字段 {key}"
    停止流程
  
  current = state[key]
  
  if schema.type == "int":
    new = current + value
    new = clamp(new, schema.range[0], schema.range[1])
  elif schema.type == "bool":
    new = value
  elif schema.type == "enum":
    if value not in schema.values:
      错误: "enum {key} 不接受值 {value}"
      停止流程
    new = value
  elif schema.type == "string":
    new = value
  
  Edit state.yaml:
    old_string: '"<key>": <current>'
    new_string: '"<key>": <new>'

# 最后更新 current_scene
Edit state.yaml:
  old_string: 'current_scene: "<old>"'
  new_string: 'current_scene: "<new>"'

# 同步更新 meta.yaml
Edit meta.yaml:
  old_string: 'last_played_at: ...'
  new_string: 'last_played_at: <现在>'
```

LLM 在 Phase 2 流转时执行的是这套**结构化伪代码**，不是散文规则。比"跟着 prompt 自由发挥"可靠很多。

### Decision 5: endings condition 用结构化 DSL

**形态**：
```yaml
endings:
  - id: "ending-judy-route"
    title: "信任 Judy 的结局"
    condition:
      all_of:
        - { key: "affinity.judy.trust", op: ">=", value: 7 }
        - { key: "flags.shared_secret", op: "==", value: true }
    body: |
      ...

  - id: "ending-rebel"
    condition:
      any_of:
        - { key: "affinity.johnny.bond", op: ">=", value: 8 }
        - all_of:
            - { key: "flags.took_relic", op: "==", value: true }
            - { key: "custom.relic_corruption", op: "<", value: 50 }
    body: |
      ...

  - id: "ending-default"
    condition: default      # 字面 default 表示无条件兜底
    body: |
      ...
```

**支持的算子**：
- 比较节点：`{ key, op, value }`，op ∈ `>= / <= / > / < / == / !=`
- 逻辑组合：`all_of` / `any_of` / `not`，可任意嵌套
- 兜底：`condition: default`（字符串字面量）

**评估算法**（SKILL.md 给 LLM 的伪代码）：
```
evaluate(node, state, schema):
  if node === "default":
    return true
  if node has all_of:
    return all children evaluate true
  if node has any_of:
    return any child evaluates true
  if node has not:
    return not evaluate(child)
  if node has key/op/value:
    schema_field = schema[key]
    if schema_field is None: return false
    current = state[key]
    return apply_op(current, op, value)
```

**Schema 验证**（Phase 1 自检 + Phase -1 加载时验证）：
- `key` 必须存在于 state_schema
- `op` 必须是合法算子之一
- `value` 类型必须匹配 `state_schema[key].type`
- 比较算子 `>= <= > <` 仅适用于 int 字段
- `==` `!=` 适用于所有类型

**结局选择规则**：endings 数组按声明顺序遍历，第一个 `evaluate(condition, state, schema) === true` 的 ending 触发。最后一个 ending **必须** `condition: default` 作为兜底。

**为什么不用字符串表达式**：
- 字符串表达式仍然依赖 LLM 语义解析（"AND" 是不是关键字？大小写敏感吗？）
- 结构化 DSL 完全机械可解析，零歧义
- LLM 写起来稍微多一点字符，但**可验证性**完胜

**第一版不加语法糖**（`in_range` / `between` 等）—— YAGNI。

### Decision 6: Phase 1 创作流程严格定步

```
Phase 1 LLM 创作 script 时严格按顺序：

Step 1: 设计 state_schema
  · 列出所有 affinity 字段（基于 story-spec 的 CharacterSpec.axes）
  · 列出所有 flags 字段（剧本里要跟踪的关键事件）
  · 列出所有 custom 字段（inventory 之外的故事专属字段）
  · 每个字段含 desc / type / range/values / default

Step 2: 写 initial_state
  · 字段集严格 == state_schema 字段集
  · 每个字段值取自 schema.default

Step 3: 写 scenes
  · 每个 choice.consequences 的 key 必须 copy 自 schema 字面 key
  · value 必须符合 schema 类型约束

Step 4: 写 endings
  · condition 用结构化 DSL
  · 每个 key 必须存在于 schema
  · 最后一个 ending 必须 condition: default

Step 5: 自检
  · 收集所有 scenes/endings 引用的 key
  · 对照 state_schema 字面比对
  · 任何 key 不存在 → 重写对应 scene/ending → 再次自检

Step 6: 通过自检后，Write 整个 script.yaml 到 runtime/scripts/script-<id>.yaml

Step 7: 输出确认 + 进入 Phase 2
```

### Decision 7: Phase -1 加载时四重验证

Phase -1 加载某个 script 时（无论是「继续游戏」还是「重玩剧本」），先做四重验证：

```
1. dangling reference 检查
   · meta.yaml.script_ref → script-<id>.yaml 文件必须存在
   · 不存在 → 标 (孤儿)，提供"删除存档"
   · 顺手解决 script-persistence 没解决的 dangling 问题

2. state_schema 完整性
   · script.yaml 顶部必须含 state_schema 块
   · 缺失 → 标 (legacy 不可重玩)，提供"删除剧本"
   · 这是 hard fail：旧 script 无 schema → 直接拒绝

3. initial_state 字段集对齐
   · initial_state 字段集必须 == state_schema 字段集
   · 不对齐 → 标 (损坏)，提供删除入口

4. scenes consequences 抽样验证
   · 抽样 5 个 scene 的 consequences
   · 每个 key 必须存在于 state_schema
   · 不通过 → 标 (损坏)，提供删除入口

如果是「继续游戏」额外验证：
5. state.yaml 字段集 == state_schema 字段集
   · 不对齐 → 弹"修复菜单"：
     · 缺失字段 → 用 schema.default 补 + 警告
     · 多余字段 → 丢弃 + 警告  
     · 类型不符 → 单字段重置为 default + 警告
   · 用户选择：修复后继续 / 完全重置 / 取消加载
```

四重验证全部通过 → 进入 Phase 2。

### Decision 8: soulkiller 端模板 lint 范围

**lint 是纯 ts 函数，跑在 packager 内部 export 流程末尾**，验证作者侧产物：

```
检查 1: SKILL.md 模板里给 LLM 的 yaml 示例能 yaml.parse 通过
检查 2: SKILL.md 模板中所有 yaml schema 示例字段名命名一致（snake_case + dot + ASCII）
检查 3: story-spec.md 中 CharacterSpec.axes 命名跟 SKILL.md 模板里 schema 示例的 affinity 命名空间约定一致
检查 4: SKILL.md 模板中所有 placeholder（<...>）格式一致

不检查：
✗ 未来 LLM 写出的 script.yaml（它在 export 时不存在）
✗ prompt 的"语义合理性"（这是 prompt engineering 主观判断）
✗ chronicle / world entries / soul files 的内容
```

**失败时的行为**：软警告——输出 lint 报告，**不阻塞 export**。理由：
- 用户拍板"由用户确定输出的产物正常"
- 强制阻塞会让 export 流程在边界情况下卡死
- 软警告 + 完整报告让作者自己审

**lint 不依赖任何外部工具**——纯 ts 函数，调用 yaml 解析（项目里已经有手写极简 parser）+ 字符串比对。无打包、无运行时依赖。

### Decision 9: 旧 skill hard fail，不向后兼容

**旧 script.yaml 没有 state_schema 块** → 加载时立刻标 (legacy)，提供"删除"入口。

**理由**：
- 用户已确认接受这个代价（"hard fail，不一定有大量沉淀存档"）
- 软兼容路径会让 SKILL.md 流程多一个条件分支，复杂度上升
- 早期项目，明确切换比拖泥带水好

**已分发出去的旧 skill 不受影响**——它们内嵌的旧 SKILL.md 没有新流程，会按旧规则继续跑。这次 change 改的是 `skill-template.ts`，新生成的 skill 才有新流程。

### Decision 10: 跨平台不收窄

整个方案不引入任何玩家端依赖：
- ✗ Bash 工具（除了 SKILL.md 已经声明的范围内）
- ✗ node / bun / deno
- ✗ skill 包内带可执行文件
- ✓ 仍然全部 SKILL.md prompt 流程
- ✓ 仍然只用宿主提供的标准工具（Read/Write/Glob/Edit/AskUserQuestion）

**目标平台**：claude.ai / Claude Code / 任何支持 SKILL.md 的 Claude，不收窄。

## Risks / Trade-offs

**[Risk] LLM 在 Phase 1 创作时不严格按 schema 引用 key** → Phase 1 自检流程是核心防线。LLM 写完后必须列出所有 consequences/endings 引用的 key 对照 schema。失败 → 重写。这仍依赖 LLM 老实执行，但比"散文 prompt 自由发挥"可靠很多。

**[Risk] LLM 在 Phase 2 用 Edit 时拼错 old_string** → Edit 工具会失败（找不到匹配字符串），LLM 看到错误后重试或 fall back 到 Read+Write。SKILL.md 明确指示失败时的 fall back 流程。

**[Risk] state.yaml 行格式被某次 Write 破坏（比如 LLM 不小心加了多行 yaml block scalar）** → Phase -1 加载时的 state 字段集验证会发现，弹修复菜单。最坏情况用户重置 slot，损失这局存档。

**[Risk] endings condition DSL 太冗长导致 LLM 写错** → DSL 形态简单（只 6 个算子 + 3 个逻辑节点），LLM 写错的概率比写自然语言表达式低。Phase 1 自检会扫一遍所有 condition。

**[Trade-off] desc 必填增加 Phase 1 prompt 长度** → 每个字段多一行文字。30-50 个字段 ≈ 50-100 行额外内容。可接受——desc 是 LLM 在重玩时的语义锚点，不能省。

**[Trade-off] flat 字典让 yaml 看起来"不自然"** → 一堆带引号的 key。但换来的是字面对齐的稳定性。作者可能觉得别扭，但 LLM 不在乎美观。

**[Trade-off] 旧 skill hard fail 损失存档** → 用户已确认接受。

**[Trade-off] Edit 工具调用次数比 Write 多** → 一次场景流转可能要 5-10 次 Edit。但 Edit 本身比 Write 快（不用序列化整个文件），实际延迟差别不大。

## Migration Plan

无运行时数据迁移——旧 skill 用旧规则跑，新 skill 用新规则跑。

实现顺序：

1. **数据约定层** — 在 `src/export/skill-template.ts` 内定义 schema yaml 示例的常量字符串，作为 SKILL.md 模板的字段命名 source of truth
2. **lint 层** — 新建 `src/export/lint/` 目录，实现 `lintSkillTemplate(content): LintReport`，纯 ts 函数
3. **Phase 1 模板改造** — buildXxxEngine 的 Phase 1 章节加 state_schema 创作步骤 + 自检流程
4. **Phase 2 模板改造** — 场景流转规则改用 Edit 工具 + 标准伪代码
5. **Phase -1 模板改造** — 加四重验证（含 dangling 检查）+ legacy 处理
6. **重玩规则微调** — 用 Write 重置 state 但只在重玩时一次性写
7. **frontmatter 改造** — `allowed-tools` 追加 `Edit`
8. **packager 集成 lint** — export 末尾调用 `lintSkillTemplate`，输出报告
9. **story-spec 同步** — 状态系统章节改写以匹配新 schema 范式
10. **测试** — 单测覆盖：lint 检测各类错误、SKILL.md 含新章节、frontmatter 含 Edit、Phase 流程顺序

## Open Questions

- **soulkiller skill verify 离线 CLI**：暂不做，但记为未来想法。如果将来 LLM 在 Phase 1 自检不可靠的反馈增多，可以补一个离线 validator 让作者主动跑。
- **List 字段类型支持**：第一版不做。如果将来玩家强烈需要 inventory（一组动态可变物品），再补 list type + add/remove 语义。
- **schema 演进 / 跨剧本迁移**：每个 script 是独立故事，schema 不需要演进。如果将来作者想"修一个旧剧本的 schema bug 同时保留存档"，需要单独的 migration tooling。
- **Edit 工具失败时的 fall back**：如果 Edit 找不到 old_string，SKILL.md 应该指示 LLM 怎么办？目前的方案是"输出错误 + 让 LLM 重新 Read + 重试 Edit"。极端情况下退到 Read+Write 整个文件。
- **chronicle 与 state 的接触面**：chronicle 中的事件可被 story 引用为 flag（例如 `flags.witnessed_arasaka_nuke`），但这是隐式语义关联。如果将来想做"chronicle 事件自动注入 state schema"，需要单独 change。
