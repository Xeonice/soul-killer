# Export Agent

Agent 驱动的导出流程，使用 Vercel AI SDK generateText + tool calling 循环，引导用户将 Soul + World 组合导出为 Cloud Skill。

## ADDED Requirements

### Requirement: Agent Loop 驱动导出流程

Export Agent SHALL 使用 Vercel AI SDK `generateText` 的 tool calling 循环驱动整个导出流程。Agent 通过 system prompt 获取导出目标和约束，通过 tools 执行数据读取、用户交互和打包操作。Agent 的 maxSteps 上限为 20。

#### Scenario: 完整导出流程

- **WHEN** 用户执行 `/export`
- **THEN** Agent SHALL 依次调用 `list_souls` → `ask_user`（选 Soul）→ `list_worlds` → `ask_user`（选 World）→ `read_soul` + `read_world` → 分析推导基调选项 → `ask_user`（选基调+结构）→ `package_skill`
- **AND** 每个步骤的进度通过回调事件传递给 UI 层

#### Scenario: 只有一个 Soul 时跳过选择

- **WHEN** `list_souls` 返回仅一个 Soul
- **THEN** Agent SHALL 直接使用该 Soul，告知用户"检测到唯一分身 {name}，将直接使用"
- **AND** 跳过 Soul 选择步骤

#### Scenario: 只有一个 World 时跳过选择

- **WHEN** `list_worlds` 返回仅一个 World
- **THEN** Agent SHALL 直接使用该 World，告知用户
- **AND** 跳过 World 选择步骤

#### Scenario: 多个 World 时用户自由选择

- **WHEN** `list_worlds` 返回多个 World
- **THEN** Agent SHALL 通过 `ask_user` 列出所有 World 供用户选择
- **AND** 已绑定的 World 可在描述中标注"已绑定"，但不限制选择范围

#### Scenario: 没有任何 World

- **WHEN** `list_worlds` 返回空
- **THEN** Agent SHALL 通过 `ask_user` 告知用户需要先创建 World

### Requirement: list_souls Tool

Export Agent SHALL 提供 `list_souls` tool，扫描 `~/.soulkiller/souls/` 目录，返回所有已蒸馏 Soul 的摘要信息。

#### Scenario: 列出多个 Soul

- **WHEN** Agent 调用 `list_souls`
- **AND** 存在 3 个 Soul（V、Johnny、Panam）
- **THEN** tool SHALL 返回包含 name、display_name、version、soul_type、evolve_count、bound_worlds 的数组

#### Scenario: 没有任何 Soul

- **WHEN** Agent 调用 `list_souls`
- **AND** `~/.soulkiller/souls/` 为空或不存在
- **THEN** tool SHALL 返回空数组
- **AND** Agent SHALL 通过 `ask_user` 告知用户需要先创建 Soul

### Requirement: list_worlds Tool

Export Agent SHALL 提供 `list_worlds` tool，列出所有可用的 World。支持可选参数 `bound_to_soul` 标注哪些 World 已绑定到指定 Soul（仅标注，不过滤）。

#### Scenario: 列出所有 World 并标注绑定状态

- **WHEN** Agent 调用 `list_worlds({ bound_to_soul: "V" })`
- **AND** V 绑定了"赛博朋克 2077"但未绑定"银翼杀手"
- **THEN** tool SHALL 返回所有 World 的摘要
- **AND** "赛博朋克 2077" 的 `is_bound` 为 true，"银翼杀手" 的 `is_bound` 为 false

#### Scenario: 不传 bound_to_soul

- **WHEN** Agent 调用 `list_worlds({})`
- **THEN** tool SHALL 返回所有 World，所有 `is_bound` 为 false

### Requirement: read_soul Tool

Export Agent SHALL 提供 `read_soul` tool，读取指定 Soul 的完整人格数据，包括 manifest、identity.md、style.md 和所有 behaviors 文件内容。

#### Scenario: 读取完整 Soul 数据

- **WHEN** Agent 调用 `read_soul({ name: "V" })`
- **THEN** tool SHALL 返回 `{ manifest, identity, style, behaviors, tags }`
- **AND** `identity` 为 `soul/identity.md` 的完整文本内容
- **AND** `style` 为 `soul/style.md` 的完整文本内容
- **AND** `behaviors` 为 `soul/behaviors/` 下所有 `.md` 文件的内容数组

#### Scenario: Soul 不存在

- **WHEN** Agent 调用 `read_soul({ name: "nonexistent" })`
- **THEN** tool SHALL 返回错误信息 "Soul 'nonexistent' not found"

### Requirement: read_world Tool

Export Agent SHALL 提供 `read_world` tool，读取指定 World 的完整世界观数据，包括 manifest 和所有 entry 内容。

#### Scenario: 读取完整 World 数据

- **WHEN** Agent 调用 `read_world({ name: "cyberpunk-2077" })`
- **THEN** tool SHALL 返回 `{ manifest, entries }`
- **AND** `entries` 为数组，每项包含 `{ name, meta, content }`
- **AND** `meta` 包含 frontmatter 中的 keywords、priority、mode、scope、dimension

### Requirement: ask_user Tool

Export Agent SHALL 提供 `ask_user` tool，向用户提出问题。支持两种模式：选项选择（提供 options 数组）和自由文本输入（设置 `allow_free_input: true`）。

#### Scenario: 选项选择

- **WHEN** Agent 调用 `ask_user({ question: "选择分身", options: [{label: "V"}, {label: "Johnny"}] })`
- **THEN** UI 层 SHALL 渲染内嵌选择组件（上下箭头 + Enter）
- **AND** 用户选择后返回 `{ answer: "V" }`

#### Scenario: 自由文本输入

- **WHEN** Agent 调用 `ask_user({ question: "描述你期望的剧情方向", allow_free_input: true })`
- **THEN** UI 层 SHALL 渲染内嵌文本输入框
- **AND** 用户输入后返回 `{ answer: "一个关于背叛的故事" }`

#### Scenario: 选项选择带描述

- **WHEN** Agent 调用 `ask_user` 且 options 中包含 `description` 字段
- **THEN** UI 层 SHALL 在选项 label 下方显示描述文字（使用 DIM 色）

### Requirement: package_skill Tool

Export Agent SHALL 提供 `package_skill` tool，将 Soul + World + story-spec 打包为 Cloud Skill 目录。支持可选的 `output_dir` 参数指定目标路径。

#### Scenario: 成功打包到默认目录

- **WHEN** Agent 调用 `package_skill({ soul_name: "V", world_name: "cyberpunk-2077", story_spec: { ... } })` 且不提供 output_dir
- **THEN** tool SHALL 创建 `~/.soulkiller/exports/v-in-cyberpunk-2077/` 目录
- **AND** 复制 Soul 文件到 `soul/` 子目录
- **AND** 复制 World 文件到 `world/` 子目录
- **AND** 生成 `story-spec.md` 文件
- **AND** 生成 `SKILL.md` 文件（基于模板填充 Soul 名称和描述）
- **AND** 返回 `{ output_dir, files }` 摘要

#### Scenario: 打包到用户指定目录

- **WHEN** Agent 调用 `package_skill({ ..., output_dir: ".claude/skills" })`
- **THEN** tool SHALL 创建 `.claude/skills/v-in-cyberpunk-2077/` 目录
- **AND** 其余行为与默认目录一致

#### Scenario: 打包到全局 skills 目录

- **WHEN** Agent 调用 `package_skill({ ..., output_dir: "~/.claude/skills" })`
- **THEN** tool SHALL 将 `~` 解析为用户 home 目录
- **AND** 创建 `~/.claude/skills/v-in-cyberpunk-2077/` 目录

#### Scenario: 导出目录已存在

- **WHEN** 目标目录下 `v-in-cyberpunk-2077/` 已存在
- **THEN** tool SHALL 覆盖写入，不提示确认（Agent 可在调用前自行询问用户）

### Requirement: 导出目标路径选择

Agent 在打包前 SHALL 通过 `ask_user` 询问用户希望将 Skill 放到哪个目录。选项包括：`.claude/skills（当前项目）`、`~/.claude/skills（全局）`、`默认导出目录（~/.soulkiller/exports）`、`自定义路径`。用户选择"自定义路径"时，Agent SHALL 再次调用 `ask_user` 允许自由文本输入。

#### Scenario: 选择当前项目 skills 目录

- **WHEN** 用户选择 ".claude/skills（当前项目）"
- **THEN** Agent SHALL 调用 `package_skill` 时传入 `output_dir: ".claude/skills"`

#### Scenario: 选择自定义路径

- **WHEN** 用户选择 "自定义路径"
- **THEN** Agent SHALL 通过 `ask_user({ allow_free_input: true })` 获取路径
- **AND** 调用 `package_skill` 时传入用户输入的路径

### Requirement: 基调推导

Agent 在读取 Soul 和 World 完整内容后，SHALL 基于 Soul 的人格特征和 World 的世界观特点，推导出 3-4 个适配的基调选项。每个选项包含 label（简短标题）和 description（一句话描述）。推导结果通过 `ask_user` 呈现给用户选择。

#### Scenario: 基于 Soul + World 推导基调

- **WHEN** Agent 读取了 V 的人格（内敛、务实、有创伤经历）和赛博朋克 2077 的世界观（高科技低生活、义体改造、企业阴谋）
- **THEN** Agent SHALL 推导出与该组合匹配的基调选项（而非通用的"悬疑/温情/冒险"）
- **AND** 通过 `ask_user` 将选项呈现给用户

### Requirement: Agent 进度事件回调

Export Agent SHALL 通过回调函数向 UI 层发送进度事件，事件类型包括：`tool_start`（tool 调用开始）、`tool_end`（tool 调用完成）、`phase_change`（阶段切换）、`ask_user_start`（进入用户交互）、`ask_user_end`（用户交互完成）、`complete`（导出完成）、`error`（导出失败）。

#### Scenario: UI 层接收 tool 进度

- **WHEN** Agent 调用 `list_souls`
- **THEN** SHALL 先发送 `tool_start({ tool: "list_souls" })` 事件
- **AND** tool 执行完成后发送 `tool_end({ tool: "list_souls", result_summary: "3 个分身" })` 事件

#### Scenario: UI 层接收 ask_user 事件

- **WHEN** Agent 调用 `ask_user`
- **THEN** SHALL 发送 `ask_user_start({ question, options })` 事件
- **AND** UI 层渲染交互组件
- **AND** 用户完成输入后发送 `ask_user_end({ answer })` 事件
