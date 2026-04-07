# Export Agent

Agent 驱动的导出**创意工作**层。Agent 接收 CLI 层预选好的角色和世界数据，专注于角色关系分析、好感轴设计、故事结构推导和打包，不再处理选择或数据扫描。

## Requirements

### Requirement: Export agent 职责收紧为创意工作
export-agent SHALL 只负责创意工作（角色关系分析、好感轴设计、基调推导、打包），不再处理选择或数据读取。

#### Scenario: runExportAgent 签名包含 preSelected 数据
- **WHEN** 调用 `runExportAgent`
- **THEN** 签名 SHALL 为 `runExportAgent(config, preSelected, onProgress, askUser)`
- **AND** `preSelected` SHALL 包含 `souls: string[]`, `worldName: string`, `soulsData: SoulFullData[]`, `worldData: WorldFullData`
- **AND** agent 不再自己扫描或读取任何数据

#### Scenario: Tools 仅保留创意工作所需
- **WHEN** 构造 agent 的 tools 对象
- **THEN** SHALL **不再包含** `list_souls`, `list_worlds`, `read_soul`, `read_world`
- **AND** SHALL 只包含 `package_skill` 和 `ask_user`（兜底）

#### Scenario: Initial prompt 携带完整数据
- **WHEN** 启动 agent stream
- **THEN** initial user message SHALL 包含完整的 world 数据（manifest + entries）
- **AND** SHALL 包含每个 soul 的 identity / style / capabilities / milestones / behaviors 完整内容
- **AND** agent 无需 tool call 即可访问全部上下文

#### Scenario: System prompt 聚焦创意
- **WHEN** 生成 agent system prompt
- **THEN** SHALL 只描述创意任务（关系分析、好感轴设计、基调推导、调用 package_skill）
- **AND** SHALL 不包含任何"自动选择"、"扫描"、"筛选"相关指引
- **AND** SHALL 明确告知 agent 不要调用 list/read 工具

### Requirement: Agent 正常路径零用户交互
Agent SHALL 在正常路径下直接分析并调用 package_skill，不通过 ask_user 询问用户。

#### Scenario: 数据充足的常规流程
- **WHEN** 收到预选数据且 soulsData/worldData 完整
- **THEN** agent SHALL 直接分析并调用 package_skill
- **AND** 总步数 SHALL 控制在 2-3 步内（思考 → package_skill → 结束）

#### Scenario: 数据严重不足的 fallback
- **WHEN** 分析中发现某些关键数据缺失（如所有 soul 都没有 identity）
- **THEN** SHALL 通过 ask_user 告知用户并建议下一步
- **AND** 不要静默停止

### Requirement: ask_user Tool（兜底）
Export Agent SHALL 提供 `ask_user` tool 作为兜底，向用户提出问题。支持单选、多选、自由文本输入三种模式。正常导出路径不应使用此 tool。

#### Scenario: 单选模式
- **WHEN** Agent 调用 `ask_user({ question, options })`
- **THEN** UI 层 SHALL 渲染单选组件
- **AND** 用户选择后返回 `{ answer: <label> }`

#### Scenario: 多选模式
- **WHEN** Agent 调用 `ask_user({ question, options, multi_select: true })`
- **THEN** UI 层 SHALL 渲染多选组件（空格切换，Enter 确认）
- **AND** 返回值 `answer` SHALL 为逗号分隔的 label 列表

#### Scenario: 自由文本输入
- **WHEN** Agent 调用 `ask_user({ question, allow_free_input: true })`
- **THEN** UI 层 SHALL 渲染文本输入框

### Requirement: 终止条件
Agent SHALL 以 package_skill 调用结束流程。

#### Scenario: 成功终止
- **WHEN** 成功调用 package_skill
- **THEN** agent SHALL 立即停止（`hasToolCall('package_skill')` 作为 stopWhen 条件）

#### Scenario: 异常终止兜底
- **WHEN** stream 结束但未调用 package_skill
- **THEN** SHALL 发出 error 事件并在消息中附带 agent log 路径
- **AND** 错误消息 SHALL 包含已执行的步数

#### Scenario: Watchdog 超时
- **WHEN** 90 秒内 stream 无任何事件
- **THEN** SHALL abort 并发出超时错误

### Requirement: Agent 进度事件回调
Export Agent SHALL 通过回调函数向 UI 层发送进度事件。

#### Scenario: 工具调用事件
- **WHEN** Agent 调用任意 tool
- **THEN** SHALL 先发送 `tool_start({ tool, args })` 事件
- **AND** tool 执行完成后发送 `tool_end({ tool, result_summary })` 事件

#### Scenario: 阶段切换
- **WHEN** Agent 进入新的执行阶段
- **THEN** SHALL 发送 `phase` 事件（initiating | analyzing | packaging | complete | error）

#### Scenario: ask_user 事件
- **WHEN** Agent 调用 `ask_user`
- **THEN** SHALL 发送 `ask_user_start({ question, options, multi_select })` 事件
- **AND** 用户响应后发送 `ask_user_end({ answer })` 事件

### Requirement: 独立日志文件
Export Agent SHALL 写入独立的 agent log，与 capture/distill agent 的日志分开。

#### Scenario: 日志路径
- **WHEN** Agent 启动
- **THEN** SHALL 创建独立日志文件于 `~/.soulkiller/logs/export/`
- **AND** 文件名格式 `<timestamp>_<hash>.log`

#### Scenario: 日志内容
- **WHEN** Agent 运行中
- **THEN** SHALL 记录每一步的 model output、tool call、tool result、错误
- **AND** 错误消息中 SHALL 包含日志文件路径以便用户查阅

### Requirement: 保留 user-driven selection 上下游契约
本 change 重构 export-agent 的内部工具结构，但 SHALL 不改变 runExportAgent 的外部签名和 initial prompt 行为。

#### Scenario: runExportAgent 签名不变
- **WHEN** CLI 层调用 runExportAgent
- **THEN** 签名 SHALL 保持为 `runExportAgent(config, preSelected, onProgress, askUser)`
- **AND** preSelected 仍然包含 `souls / worldName / soulsData / worldData`

#### Scenario: Initial prompt 仍携带完整数据
- **WHEN** 启动 agent stream
- **THEN** initial user message SHALL 仍然包含完整的 world 数据和每个 soul 的完整文件内容
- **AND** agent 仍然无需 tool call 即可访问全部上下文

### Requirement: 分阶段工具集
Export Agent SHALL 通过分阶段工具集（set_story_metadata + add_character + set_character_axes + finalize_export）替代单次大调用。每个工具的 input 都 SHALL 控制在小尺寸以避免 LLM 生成失败。finalize_export 不接受 output_dir 参数（由 CLI 层控制）；finalize_export 的输出 SHALL 反映 `.skill` 归档文件路径而非展开目录路径。

#### Scenario: set_story_metadata 设定故事框架
- **WHEN** Agent 调用 `set_story_metadata({ genre, tone, constraints, acts_options, default_acts })`
- **AND** acts_options 包含 2-3 个 ActOption 元素
- **AND** default_acts 等于 acts_options 中某项的 acts 值
- **THEN** SHALL 将参数保存到 ExportBuilder 的 metadata 字段
- **AND** 返回 `{ ok: true, summary }`

#### Scenario: add_character 注册角色
- **WHEN** Agent 调用 `add_character({ name, role, display_name?, appears_from?, dynamics_note? })`
- **AND** name 在 preSelected.souls 列表中
- **AND** 该 name 尚未添加过
- **AND** 已添加角色数 < 4
- **THEN** SHALL 创建角色草稿加入 builder.characters
- **AND** 返回 `{ ok: true, summary }`

#### Scenario: set_character_axes 设置好感轴
- **WHEN** Agent 调用 `set_character_axes({ character_name, axes })`
- **AND** character_name 已通过 add_character 添加
- **AND** axes 长度 2-3
- **THEN** SHALL 写入对应角色草稿
- **AND** 返回 `{ ok: true, summary }`

#### Scenario: finalize_export 触发打包并返回归档路径
- **WHEN** Agent 调用 `finalize_export({})`
- **AND** ExportBuilder 状态完整
- **THEN** SHALL 通过 builder.build() 构造 story_spec
- **AND** SHALL 调用 packageSkill 生成 `.skill` 归档文件
- **AND** 返回值 SHALL 包含 `output_file`, `file_count`, `size_bytes`, `skill_file_name`, `soul_count`
- **AND** SHALL 不再包含 `output_dir` 或 `files` 数组字段

#### Scenario: complete 进度事件适配
- **WHEN** finalize_export 成功
- **THEN** SHALL 发出 `complete` 事件且 payload 包含 `.skill` 文件路径
- **AND** 事件字段 SHALL 包括: `output_file: string`, `file_count: number`, `size_bytes: number`, `skill_name: string`

### Requirement: ExportBuilder 累积器
Export Agent 的 runExportAgent 函数 SHALL 维护一个 ExportBuilder 实例累积工具调用结果，agent 结束后自动 GC。

#### Scenario: Builder 生命周期
- **WHEN** runExportAgent 启动
- **THEN** SHALL 创建新的 ExportBuilder 实例
- **AND** 该实例在闭包中被各 tool 的 execute 共享访问

#### Scenario: 跨 agent 调用隔离
- **WHEN** 多个 runExportAgent 并发执行
- **THEN** 每次调用 SHALL 使用独立的 ExportBuilder 实例

### Requirement: 工具错误返回值而非抛出
所有 export agent 工具的 execute 函数 SHALL 通过返回 `{ error }` 反馈错误，而不是 throw。

#### Scenario: 校验失败
- **WHEN** 工具内部校验失败
- **THEN** SHALL 返回 `{ error: "..." }`
- **AND** 不抛出异常
- **AND** Agent 可在下一步看到错误并修正

#### Scenario: 内部异常
- **WHEN** execute 函数内部抛出未预期异常
- **THEN** SHALL 由顶层 try/catch 捕获
- **AND** 返回 `{ error: <message> }`

### Requirement: System prompt 引导分阶段调用
Export Agent 的 SYSTEM_PROMPT SHALL 明确指引 agent 按 set_story_metadata → add_character + set_character_axes (per character) → finalize_export 的顺序调用工具。

#### Scenario: Prompt 包含工作流说明
- **WHEN** 构造 SYSTEM_PROMPT
- **THEN** SHALL 包含明确的分阶段调用顺序说明
- **AND** SHALL 强调每次调用 input 简短
- **AND** SHALL 说明遇到 error 应根据信息修正后重试

#### Scenario: 终止条件
- **WHEN** 配置 stopWhen
- **THEN** SHALL 包含 `hasToolCall('finalize_export')` 作为成功终止条件

### Requirement: System prompt 保留多角色叙事设计指引
SYSTEM_PROMPT SHALL 保留来自 multi-soul-export 的核心叙事设计规则，确保 agent 在分阶段调用时仍生成符合预期的故事结构。

#### Scenario: 角色数与 acts_options 推荐
- **WHEN** 构造 SYSTEM_PROMPT
- **THEN** SHALL 包含规则:
  - 角色数 ≤ 2 → 推荐 acts_options [3, 5]，default_acts 3
  - 角色数 3-4 → 推荐 acts_options [3, 5, 7]，default_acts 5
- **AND** SHALL 引导 agent 为每个选项生成对应的 rounds_total ≈ acts × 8-12 和 endings_count ≈ acts + 1
- **AND** SHALL 说明幕数最终由用户在 skill 启动时选择，agent 只负责给出合理选项

#### Scenario: 基调独特性要求
- **WHEN** 构造 SYSTEM_PROMPT
- **THEN** SHALL 明确要求 tone 反映该角色组合的独特性，禁止使用通用的"悬疑/温情/冒险"
- **AND** SHALL 引导 agent 基于实际读到的 Soul 人格和 World 内容推导基调

#### Scenario: tradeoff 约束要求
- **WHEN** 构造 SYSTEM_PROMPT
- **THEN** SHALL 引导 agent 在 set_story_metadata 的 constraints 中包含至少一条 tradeoff 约束
- **AND** SHALL 说明 tradeoff 约束的含义: 每个选项必须对不同角色产生差异化好感影响

#### Scenario: 角色 role 分配指引
- **WHEN** 构造 SYSTEM_PROMPT
- **THEN** SHALL 引导 agent 推荐至少 1 个 protagonist
- **AND** 多角色时建议有 1 个 deuteragonist 与 protagonist 形成叙事张力
- **AND** antagonist 是可选项

### Requirement: ExportBuilder.build 输出符合 packager 契约
ExportBuilder 的 build() 方法 SHALL 产出符合 `StorySpecConfig` 类型的完整对象，可直接传给 `packageSkill`。

#### Scenario: build 输出结构
- **WHEN** 调用 build()
- **THEN** 返回值 SHALL 包含 souls, world_name, story_spec
- **AND** story_spec SHALL 包含 genre, tone, acts, endings_min, rounds, constraints, characters
- **AND** characters 数组中的每个元素 SHALL 至少有 name, role, axes
- **AND** 类型完全匹配 packager 期望的 `StorySpecConfig`

### Requirement: PreSelectedExportData 包含 storyName 和 outputBaseDir
export-agent 的 `runExportAgent` SHALL 接收包含 storyName 和 outputBaseDir 的预选数据。storyDirection 为可选。

#### Scenario: 必填字段
- **WHEN** CLI 调用 runExportAgent
- **THEN** preSelected SHALL 必须包含 `storyName: string`（非空）和 `outputBaseDir: string`（绝对路径）

#### Scenario: 可选字段
- **WHEN** preSelected 提供 `storyDirection?: string`
- **THEN** agent SHALL 将其作为用户原始意图处理
- **WHEN** 未提供 storyDirection
- **THEN** agent SHALL 按现有逻辑（完全自主）生成故事

### Requirement: Initial prompt 注入用户原始意图
当 `storyDirection` 存在时，`buildInitialPrompt` SHALL 将其作为顶部的独立块注入，标记为"用户原始意图（最高优先级）"。

#### Scenario: 有 storyDirection
- **WHEN** preSelected.storyDirection 非空
- **THEN** initial prompt 的最前部 SHALL 有独立的 "# 用户原始意图（最高优先级）" 块
- **AND** 块内容 SHALL 为原始 storyDirection 文本
- **AND** 后接 "# 故事名" 块再接 souls/world 数据

#### Scenario: 无 storyDirection
- **WHEN** storyDirection 未提供
- **THEN** initial prompt SHALL 仍包含 "# 故事名" 块
- **AND** 不包含"用户原始意图"块

### Requirement: SYSTEM_PROMPT 强调用户意图优先
export-agent 的 SYSTEM_PROMPT SHALL 明确引导 agent：若 initial prompt 中包含"用户原始意图"块，该意图优先于 agent 的自主决策。

#### Scenario: Prompt 包含意图处理规则
- **WHEN** 构造 SYSTEM_PROMPT
- **THEN** SHALL 包含一段说明："如果 initial prompt 中包含'用户原始意图'块，这是最高优先级引导"
- **AND** SHALL 说明 agent 生成的 tone / constraints / 角色 role 分配必须反映该意图
- **AND** SHALL 说明用户未提到的细节可以自主决定，但不要偏离用户方向
