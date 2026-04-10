## Why

> **Hot fix scope (added 2026-04-08)**: 实现过程中发现 packager 生成的 .skill 归档**违反 Anthropic Skill 官方 spec 的 4 处硬性约束**，导致 upload 失败。本 change 范围扩展，把这些违规一并修复：
> 1. SKILL.md frontmatter 的 `name` 字段含 CJK 字符（spec 要求 `^[a-z0-9]+(-[a-z0-9]+)*$`）
> 2. 归档顶层结构错了（spec 要求 `<skill-name>/SKILL.md` 嵌套，我们直接放在 zip 根）
> 3. souls 子目录路径含 CJK（38 个文件名违规）
> 4. `allowed-tools` 用了逗号分隔（spec 要求空格分隔或 yaml list）
>
> 配套把 lint 升级为 **formatter**：对 deterministic 可修复的 spec 违规（slugify、normalize 分隔符、补 archive 前缀）packager 自动 format，不再依赖作者 lint 后人工修复。

`script-persistence` 让剧本能落到磁盘，但留下了一个软地带：剧本和存档里的运行时状态仍然是 LLM "内部对象的快照"。state.yaml 由 LLM 每轮 read-modify-write 整个文件来维护，字段命名靠 SKILL.md 里的示例提示，没有强制结构。结果是：
- LLM 在 Phase 1 写 scenes 时可能创造 schema 之外的字段
- 重玩时 LLM 重写整个 state.yaml，可能漏行 / 错引号 / 字段顺序漂
- 选项 consequences 引用的字段拼写不一致（`affinity.judy.trust` vs `Judy.trust`）
- 结局判定条件用自然语言写，无法机械验证

这些问题的根因不是"LLM 解析 yaml 会漂"——LLM 读字面字符串是稳定的——而是 **Phase 1 写入时缺少结构化契约 + state 更新使用了高风险的全文件重写**。本提案通过两件事一并解决：

1. **state_schema 显式声明**：每个 script.yaml 顶部嵌入 flat 字典 schema，所有可能跟踪的字段（key + type + range + default + desc）一次性列清楚。consequences 和 endings condition 都只能引用 schema 里的字面 key。
2. **state 更新改用 Edit 工具行级替换**：state.yaml 用 flat 字面字符串 key 一行一字段的格式，更新时只用 Edit 替换变化的那一行，永远不重写整个文件。

## What Changes

- **新增 `state_schema` 块**嵌入 script.yaml 顶部，flat 字典：
  ```yaml
  state_schema:
    "affinity.judy.trust":
      desc: "Judy 对玩家的信任"
      type: int
      range: [0, 10]
      default: 5
    "flags.met_johnny":
      desc: "玩家是否已遇到 Johnny"
      type: bool
      default: false
    "custom.location":
      desc: "玩家当前所在地"
      type: enum
      values: ["watson", "westbrook", "pacifica"]
      default: "watson"
  ```
- **schema 字段命名约束**：snake_case + dot 分隔 + ASCII，全部带引号字面字符串
- **schema 类型集合**：第一版仅 `int / bool / enum / string`，不支持 list/float/datetime/nested
- **`desc` 字段必填**：作为 LLM 在重玩时的语义锚点
- **顶层 flat**：没有 affinity/flags/custom 的中间层，前缀是命名约定，系统不解析
- **`initial_state` 字段集严格 == `state_schema` 字段集**
- **scenes consequences key 必须 copy 自 schema 字面 key**（精确字符串匹配）
- **consequences 语义按 type 决定**：
  - `int` → 加法 delta（数值表示加减）
  - `bool / enum / string` → 绝对覆盖
- **endings condition 改为结构化 DSL**：
  - 比较节点：`{ key, op, value }`，op ∈ `>= / <= / > / < / == / !=`
  - 逻辑节点：`all_of` / `any_of` / `not`，可任意嵌套
  - 兜底：`condition: default`
- **state.yaml 行格式严格化**：flat 字面字符串字典，一行一字段，跟 schema 一一对齐
- **state.yaml 更新改用 `Edit` 工具行级替换**：每个变化字段一次 `Edit(old_string, new_string)`，**不再用 Write 重写整个文件**
- **meta.yaml 同样用 Edit 更新** `last_played_at` 与 `current_scene`
- **SKILL.md `allowed-tools` 追加 `Edit`**
- **Phase 1 创作步骤明确化**：schema → initial_state → scenes → endings → 自检 → Write
- **Phase 1 自检流程**：写完 script 后列出所有 consequences/endings 引用的 key，对照 schema 字面比对，不符则重写
- **Phase -1 加载验证流程**：加载某个 script 前先验证 dangling reference + state_schema 完整性 + initial_state 字段集一致性 + 抽样 scene consequences 字段引用合法
- **Phase -1 顺手处理 dangling save**：meta.yaml.script_ref 指向的 script 文件不存在 → 标 (孤儿) → 提供删除入口
- **重玩规则微调**：复用 script + 用 Edit 把 state.yaml 重置为 initial_state（不再 Write 整个文件）
- **BREAKING** 旧 script（无 state_schema 块）→ hard fail，标 (legacy 不可重玩)，菜单只提供删除入口
- **新增 soulkiller 端模板 lint**（纯 ts，跑在 packager 内）：
  - SKILL.md 模板里给 LLM 的 schema 示例 yaml.parse 通过
  - SKILL.md 模板中所有 placeholder 语法一致
  - story-spec.md 中 `CharacterSpec.axes` 命名跟 SKILL.md 模板里的 schema 示例命名空间一致
  - 失败 → 软警告（不阻塞 export，由作者审核决定是否分发）
- **Phase 2 场景流转规则更新**：consequences apply 流程由"标准伪代码"明确，LLM 严格按步骤执行（查 schema → 取当前值 → 按 type 计算 → 范围/枚举校验 → Edit 替换行）

## Capabilities

### New Capabilities
- `state-schema`: 剧本运行时状态的显式 schema 契约（字段集、类型、范围、默认值、命名约束、consequences/condition DSL 语法）

### Modified Capabilities
- `cloud-skill-format`: SKILL.md 模板新增 state_schema 流程、Phase 1 创作步骤、Phase -1 加载验证、Phase 2 用 Edit 而非 Write 更新 state、`allowed-tools` 追加 `Edit`、重玩规则细化、dangling save 检查;旧 script 无 state_schema 时 hard fail。

## Impact

**代码改动**：
- `src/export/skill-template.ts` — Phase 1/Phase -1/Phase 2 章节大改；新增 state_schema 创作流程伪代码、Edit 更新流程伪代码、dangling 检查；frontmatter `allowed-tools` 追加 Edit
- `src/export/story-spec.ts` — buildXxxStateSystem 章节同步新规范（数值轴 → 命名空间 schema 字段；事件标记 → flag schema 字段）
- `src/export/packager.ts` — export 流程末尾调用模板 lint，输出报告
- `src/export/lint/` (新建) — 模板 lint 实现：yaml.parse 校验 + 字段命名一致性扫描

**Skill 运行时**：
- 玩家端**零新增依赖**：所有改动都在 SKILL.md 内自然语言流程 + 内置 Edit/Read/Write/Glob 工具
- 跨平台不变：claude.ai / Claude Code / 任何 Claude 都能跑

**对已分发 skill 的影响**：
- 旧 skill 内嵌的旧 SKILL.md 不会自动升级（它们继续按旧规则跑）
- 用旧 skill 生成的 script 在新版 SKILL.md 加载时会被识别为 legacy → hard fail
- 用户失去旧存档是已知代价（早期项目，可承受）

**用户体验**：
- 重玩可靠性显著提升（schema + Edit 双重锁定）
- Phase 1 LLM 写剧本的创作负担略增（必须先想清楚 schema）
- Phase 2 场景流转每次多 2-5 个 Edit 调用（但 Edit 比 Write 快得多）

**与 chronicle 的关系**：
- chronicle 是世界级时间档案，state_schema 是 story 级运行时状态，**两个解耦层**
- chronicle 中的事件可被 story 引用（如 `flags.witnessed_arasaka_nuke`），但这是隐式语义关联，不需要系统层面的硬绑定
- 时间过滤（hard-time clock）仍属 chronicle 的后续 follow-up，不在本提案范围
