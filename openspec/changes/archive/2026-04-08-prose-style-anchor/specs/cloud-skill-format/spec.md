## ADDED Requirements

### Requirement: SKILL.md 引用 prose_style 叙事风格锚点
SKILL.md Phase 1 创作步骤和 Phase 2 场景呈现规则 SHALL 引用 story-spec.md 的「叙事风格锚点」章节，把 ProseStyle.forbidden_patterns 当成写 narration / dialogue 的硬约束，把 ip_specific 当成本故事的术语规范。

#### Scenario: Phase 1 创作引用 prose_style
- **WHEN** 生成 SKILL.md
- **THEN** Phase 1 章节 SHALL 在 Step 3 (写 scenes) 前明确指示："写 narration / dialogue 时，先 Read story-spec.md 的『叙事风格锚点』章节，逐条对照 forbidden_patterns 自检每一段产出的中文是否触犯反例"
- **AND** Phase 1 章节 SHALL 列出 ip_specific bullet 作为本故事术语规范

#### Scenario: Phase 2 场景呈现引用 prose_style
- **WHEN** 生成 SKILL.md
- **THEN** Phase 2「场景呈现规则」段 SHALL 含 prose_style 引用条款
- **AND** SHALL 把 forbidden_patterns 渲染成清单格式，每条前加"**必须避免**"字样
- **AND** SHALL 引导 LLM 在每段输出前在脑内做反例对照

#### Scenario: 缺 prose_style 的 fallback 渲染
- **WHEN** StorySpecConfig 不含 prose_style
- **THEN** SKILL.md SHALL 渲染一段通用 fallback 中文写作指引
- **AND** fallback 内容 SHALL 包含通用反例库中至少 5 条最高频条目

### Requirement: prose_style 在 character_voice_summary 存在时的引用
当 story-spec.md 的 prose_style 章节含 `character_voice_summary` 字段时，SKILL.md Phase 2 SHALL 指示 LLM 把对应角色的 character_voice_summary 作为该角色的优先中文声音锚点（高于 style.md 中可能存在的非目标语言原文）。

#### Scenario: 角色含 voice_summary
- **WHEN** prose_style.character_voice_summary["间桐桜"] 存在
- **THEN** SKILL.md Phase 2 SHALL 引导 LLM："演绎间桐桜时，优先使用 prose_style.character_voice_summary['间桐桜'] 作为中文声音锚点；style.md 中的日文/英文台词作为补充事实参考"

#### Scenario: 角色无 voice_summary
- **WHEN** prose_style.character_voice_summary 中没有该角色
- **THEN** Phase 2 按原有方式直接使用 style.md

## MODIFIED Requirements

### Requirement: 场景呈现规则

SKILL.md SHALL 定义场景呈现规则：旁白使用沉浸式第二人称描写；角色台词/动作根据场景指导即兴演绎，遵守 identity.md 人格和 style.md 表达方式；选项通过 AskUserQuestion 呈现。**所有产出的中文文本 SHALL 遵守 story-spec.md 的「叙事风格锚点」章节中的 forbidden_patterns（硬约束）和 ip_specific（术语规范）**。

#### Scenario: 标准场景输出

- **WHEN** Claude 运行到一个场景
- **THEN** SHALL 先输出旁白文本（遵守 prose_style 约束）
- **THEN** 输出角色的台词和动作（基于角色演出指导即兴表演，遵守 prose_style 约束）
- **THEN** 使用 AskUserQuestion 呈现 2-3 个选项

#### Scenario: 用户自由输入

- **WHEN** 用户不通过选项回复而是输入自由文本
- **THEN** Claude SHALL 作为角色在场景内回应该对话（遵守 prose_style 约束）
- **THEN** 再次使用 AskUserQuestion 呈现同一场景的选项（不跳转）

#### Scenario: prose_style 缺失场景
- **WHEN** story-spec.md 不含 prose_style 章节（向后兼容旧 export）
- **THEN** Claude SHALL 使用 SKILL.md 的 fallback 通用中文写作指引
