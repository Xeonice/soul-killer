## MODIFIED Requirements

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
