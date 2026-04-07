## ADDED Requirements

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
Export Agent SHALL 通过分阶段工具集（set_story_metadata + add_character + set_character_axes + finalize_export）替代单次大调用 package_skill。每个工具的 input 都 SHALL 控制在小尺寸以避免 LLM 生成失败。

#### Scenario: set_story_metadata 设定故事框架
- **WHEN** Agent 调用 `set_story_metadata({ genre, tone, constraints, acts_options, default_acts })`
- **AND** acts_options 包含 2-3 个 ActOption 元素，每个含 `{ acts, label_zh, rounds_total, endings_count }`
- **AND** default_acts 等于 acts_options 中某项的 acts 值
- **THEN** SHALL 将参数保存到 ExportBuilder 的 metadata 字段
- **AND** 返回 `{ ok: true, summary: "Metadata saved: <N> length options (default <X> acts)" }`

#### Scenario: set_story_metadata 校验失败
- **WHEN** acts_options 为空数组或 default_acts 不在 acts_options 中
- **THEN** SHALL 返回 `{ error: <说明> }`
- **AND** 不写入 builder.metadata

#### Scenario: add_character 注册角色
- **WHEN** Agent 调用 `add_character({ name, role, display_name?, appears_from?, dynamics_note? })`
- **AND** name 在 preSelected.souls 列表中
- **AND** 该 name 尚未通过 add_character 添加过
- **THEN** SHALL 创建角色草稿，加入 builder.characters
- **AND** 返回 `{ ok: true, summary: "Character N/M added: <name> (<role>)" }`

#### Scenario: add_character name 不在预选列表
- **WHEN** Agent 传入的 name 不在 preSelected.souls 中
- **THEN** SHALL 返回 `{ error: "'<name>' not in pre-selected souls" }`

#### Scenario: add_character 重复添加
- **WHEN** 同一个 name 第二次调用 add_character
- **THEN** SHALL 返回 `{ error: "Character '<name>' already added" }`

#### Scenario: add_character 角色数超过上限
- **WHEN** ExportBuilder 已经累积了 4 个角色，agent 再次调用 add_character
- **THEN** SHALL 返回 `{ error: "Maximum 4 characters allowed per export" }`
- **AND** 不增加 builder.characters

#### Scenario: set_character_axes 设置好感轴
- **WHEN** Agent 调用 `set_character_axes({ character_name, axes })`
- **AND** character_name 已通过 add_character 添加
- **AND** axes 长度在 2-3 之间
- **THEN** SHALL 将 axes 写入对应角色草稿
- **AND** 返回 `{ ok: true, summary: "Axes set for <name>: <axis names>" }`

#### Scenario: set_character_axes 角色未添加
- **WHEN** character_name 未通过 add_character 添加
- **THEN** SHALL 返回 `{ error: "Character '<name>' not added yet" }`

#### Scenario: set_character_axes axes 数量不合法
- **WHEN** axes 长度小于 2 或大于 3
- **THEN** SHALL 返回 `{ error: "axes 必须 2-3 个" }`

#### Scenario: finalize_export 触发打包
- **WHEN** Agent 调用 `finalize_export({ output_dir? })`
- **AND** ExportBuilder 状态完整（metadata 已设定 + 至少 1 个 character + 所有 character 都有 axes）
- **THEN** SHALL 调用底层 packageSkill 完成打包
- **AND** 发出 `complete` 进度事件
- **AND** 返回 `{ output_dir, files, skill_dir_name, soul_count }`

#### Scenario: finalize_export 状态不完整
- **WHEN** ExportBuilder 缺少 metadata 或缺少 character 或某 character 缺 axes
- **THEN** SHALL 返回 `{ error: "<具体缺少什么>" }`
- **AND** Agent 可在下一步补全后重试

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

## REMOVED Requirements

### Requirement: package_skill Tool
**Reason**: 单次大输入的 package_skill 工具被证明对 LLM 不友好——~1000 tokens 的嵌套结构化 JSON 导致生成慢、易错、glm-5 等模型直接失败。

**Migration**: 替换为 set_story_metadata + add_character + set_character_axes + finalize_export 的分阶段工具集，每个工具 input ≤ 200 tokens。底层 packageSkill 函数本身保留不变，由 finalize_export 内部调用。
