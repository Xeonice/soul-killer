# Cloud Skill Format

Cloud Skill 导出产物格式定义，包括目录结构、SKILL.md 模板（视觉小说引擎）和 story-spec.md（剧本生成规约）。

## ADDED Requirements

### Requirement: Skill 目录结构

导出的 Cloud Skill SHALL 符合以下目录结构：

```
{soul}-in-{world}/
├── SKILL.md
├── soul/
│   ├── identity.md
│   ├── style.md
│   └── behaviors/
│       └── *.md
├── world/
│   ├── world.json
│   └── entries/
│       └── *.md
└── story-spec.md
```

#### Scenario: 验证导出目录结构

- **WHEN** `package_skill` 执行完成
- **THEN** 输出目录 SHALL 包含 SKILL.md、soul/ 目录、world/ 目录和 story-spec.md
- **AND** soul/ 下 SHALL 包含与源 Soul 相同的 identity.md、style.md 和 behaviors/ 文件
- **AND** world/ 下 SHALL 包含 world.json 和 entries/ 下的所有 .md 文件

### Requirement: SKILL.md 视觉小说引擎模板

SKILL.md SHALL 作为视觉小说引擎的调度器 prompt，包含 YAML frontmatter 和三阶段运行指令。

#### Scenario: SKILL.md frontmatter

- **WHEN** SKILL.md 生成
- **THEN** frontmatter SHALL 包含 `name`（格式 `{soul}-in-{world}`）、`description`（视觉小说描述）、`allowed-tools: Read`

#### Scenario: Phase 0 — Story Seeds 询问

- **WHEN** Skill 被加载运行
- **THEN** SKILL.md SHALL 指示 Claude 使用 AskUserQuestion 询问用户："你想要一个怎样的故事？"
- **AND** 选项包含"让命运来决定"（seeds 为空）和"我有一些想法"（进入自由输入）
- **AND** 用户选择"我有一些想法"后，SKILL.md SHALL 指示 Claude 收集用户的自然语言描述作为 seeds

#### Scenario: Phase 1 — 动态剧本生成

- **WHEN** Phase 0 完成
- **THEN** SKILL.md SHALL 指示 Claude 读取 `${CLAUDE_SKILL_DIR}/soul/` 下的人格文件、`${CLAUDE_SKILL_DIR}/world/entries/` 下的世界观文件、`${CLAUDE_SKILL_DIR}/story-spec.md` 的规约
- **AND** 结合用户 seeds（如有），生成完整的视觉小说剧本
- **AND** 剧本保存在 Claude 的内部上下文中，不输出给用户

#### Scenario: Phase 2 — 视觉小说交互循环

- **WHEN** Phase 1 完成
- **THEN** SKILL.md SHALL 指示 Claude 从第一个场景开始运行故事
- **AND** 每个场景输出旁白文本（第二人称沉浸式）+ 角色演绎
- **AND** 使用 AskUserQuestion 呈现场景选项
- **AND** 用户选择后跳转到对应的下一场景
- **AND** 到达结局场景后展示结局文字，故事结束

### Requirement: 场景呈现规则

SKILL.md SHALL 定义场景呈现规则：旁白使用沉浸式第二人称描写；角色台词/动作根据场景指导即兴演绎，遵守 identity.md 人格和 style.md 表达方式；选项通过 AskUserQuestion 呈现。

#### Scenario: 标准场景输出

- **WHEN** Claude 运行到一个场景
- **THEN** SHALL 先输出旁白文本
- **THEN** 输出角色的台词和动作（基于角色演出指导即兴表演）
- **THEN** 使用 AskUserQuestion 呈现 2-3 个选项

#### Scenario: 用户自由输入

- **WHEN** 用户不通过选项回复而是输入自由文本
- **THEN** Claude SHALL 作为角色在场景内回应该对话
- **THEN** 再次使用 AskUserQuestion 呈现同一场景的选项（不跳转）

### Requirement: 幕间过渡规则

SKILL.md SHALL 定义幕间过渡规则：Act 切换时输出过渡旁白（氛围性文字 + 居中 Act 标题），然后通过 AskUserQuestion 呈现反思性选择。

#### Scenario: 幕间过渡

- **WHEN** 故事从 Act 1 推进到 Act 2
- **THEN** Claude SHALL 输出过渡文本块（使用 ━ 分隔线 + Act 标题 + 氛围旁白）
- **THEN** 使用 AskUserQuestion 呈现反思性选择（2-3 个情绪/思绪方向）
- **AND** 该选择不改变剧情走向，但影响下一幕开场时角色的态度/语气

### Requirement: 世界观补充规则

SKILL.md SHALL 指示 Claude 在场景涉及特定世界观知识时，读取 `${CLAUDE_SKILL_DIR}/world/entries/` 下的对应文件来补充细节。

#### Scenario: 场景涉及特定地点

- **WHEN** 场景提及某个世界观中的地点
- **THEN** Claude SHALL 读取 world/entries/ 中与该地点相关的条目
- **AND** 将细节自然融入旁白和角色对话中

### Requirement: 禁止事项

SKILL.md SHALL 明确禁止以下行为：不跳过场景、不编造剧本中没有的分支、不打破第四面墙、不在选项之外主动推进剧情。

#### Scenario: 违规行为约束

- **WHEN** 故事正在运行
- **THEN** Claude SHALL 严格遵循生成的剧本结构
- **AND** 不得跳过任何场景或自行创造未定义的分支

### Requirement: story-spec.md 剧本生成规约

story-spec.md SHALL 包含 YAML frontmatter（genre、tone、acts、endings_min、rounds）和结构化的剧本生成规约。规约定义结构要求、场景格式、叙事约束、角色约束、幕间过渡规则和禁止事项。

#### Scenario: story-spec.md 内容

- **WHEN** `package_skill` 生成 story-spec.md
- **THEN** frontmatter SHALL 包含 Export Agent 收集的 genre、tone、acts、endings_min、rounds 配置
- **AND** 规约 SHALL 包含场景格式定义（[narration]、[character]、[choices] 块）
- **AND** 规约 SHALL 包含角色约束（必须符合 soul/ 下的人格和风格文件）
- **AND** 规约 SHALL 包含叙事约束（选项必须产生实质分歧、结局之间有明显情感差异等）

#### Scenario: story-spec.md 包含 seeds 占位

- **WHEN** story-spec.md 生成
- **THEN** SHALL 包含 Seeds 段落说明，指示 Skill 运行时 Phase 0 收集的 seeds 应插入此处

### Requirement: 导出物命名规则

导出物目录名 SHALL 遵循 `{soul-name}-in-{world-name}` 格式，使用 kebab-case。输出路径由用户在导出流程中选择，默认为 `~/.soulkiller/exports/{name}/`。

#### Scenario: 标准命名

- **WHEN** 导出 Soul "V" + World "cyberpunk-2077"
- **THEN** 目录名 SHALL 为 `v-in-cyberpunk-2077`

#### Scenario: 输出到用户选择的目录

- **WHEN** 用户选择目标路径为 `.claude/skills`
- **THEN** 输出到 `.claude/skills/v-in-cyberpunk-2077/`

#### Scenario: 输出到默认目录

- **WHEN** 用户选择 "默认导出目录" 或未指定 output_dir
- **THEN** 输出到 `~/.soulkiller/exports/v-in-cyberpunk-2077/`
