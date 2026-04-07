## ADDED Requirements

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

## MODIFIED Requirements

### Requirement: 分阶段工具集
Export Agent SHALL 通过分阶段工具集（set_story_metadata + add_character + set_character_axes + finalize_export）替代单次大调用。每个工具的 input 都 SHALL 控制在小尺寸以避免 LLM 生成失败。finalize_export SHALL 不再接受 output_dir 参数（由 CLI 层控制）。

#### Scenario: set_story_metadata 设定故事框架
- **WHEN** Agent 调用 `set_story_metadata({ genre, tone, constraints, acts_options, default_acts })`
- **AND** acts_options 包含 2-3 个 ActOption 元素
- **AND** default_acts 等于 acts_options 中某项的 acts 值
- **THEN** SHALL 将参数保存到 ExportBuilder 的 metadata 字段
- **AND** 返回 `{ ok: true, summary: "Metadata saved: ..." }`

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

#### Scenario: finalize_export 触发打包（新签名）
- **WHEN** Agent 调用 `finalize_export({})`
- **AND** ExportBuilder 状态完整
- **THEN** SHALL 通过 builder.build() 构造 story_spec
- **AND** SHALL 调用 `packageSkill({ souls, world_name, story_name: preSelected.storyName, story_spec, output_base_dir: preSelected.outputBaseDir })`
- **AND** SHALL 发出 complete 事件

#### Scenario: finalize_export 不再接受 output_dir
- **WHEN** 构造 finalize_export tool 的 inputSchema
- **THEN** SHALL 不包含 `output_dir` 字段
- **AND** SHALL 不接受任何路径相关参数
- **AND** 路径由 CLI 预设并通过 preSelected.outputBaseDir 传入
