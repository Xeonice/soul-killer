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

SKILL.md SHALL 作为视觉小说引擎的调度器 prompt，包含 YAML frontmatter 和三阶段运行指令。Phase 1 SHALL 新增读取 capabilities.md 和 milestones.md 的指令。Phase 2 SHALL 新增引用规则。

#### Scenario: SKILL.md frontmatter

- **WHEN** SKILL.md 生成
- **THEN** frontmatter 的 `name` 字段 SHALL 使用 `soulkiller:{soul}-in-{world}` 格式
- **AND** 包含 `description` 和 `allowed-tools: Read`

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

#### Scenario: Phase 1 读取新文件

- **WHEN** Skill 运行 Phase 1
- **THEN** SHALL 读取 `${CLAUDE_SKILL_DIR}/soul/capabilities.md`（如存在）
- **AND** 读取 `${CLAUDE_SKILL_DIR}/soul/milestones.md`（如存在）
- **AND** 将能力信息和时间线纳入剧本生成的参考材料

#### Scenario: Phase 2 — 视觉小说交互循环

- **WHEN** Phase 1 完成
- **THEN** SKILL.md SHALL 指示 Claude 从第一个场景开始运行故事
- **AND** 每个场景输出旁白文本（第二人称沉浸式）+ 角色演绎
- **AND** 使用 AskUserQuestion 呈现场景选项
- **AND** 用户选择后跳转到对应的下一场景
- **AND** 到达结局场景后展示结局文字，故事结束

#### Scenario: Phase 2 能力引用规则

- **WHEN** 用户在故事中问及角色的能力、技能或装备
- **THEN** Claude SHALL 参考 capabilities.md 中的描述回答
- **AND** 角色行为不超出 capabilities.md 描述的能力范围

#### Scenario: Phase 2 时间线引用规则

- **WHEN** 用户在故事中问及角色的经历或过去事件
- **THEN** Claude SHALL 参考 milestones.md 中的记录回答
- **AND** 角色只知道 milestones.md 中记录的事件，不知道之后发生的事

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

导出物目录名 SHALL 遵循 `soulkiller:{soul-name}-in-{world-name}` 格式。输出路径由用户在导出流程中选择。

#### Scenario: 标准命名

- **WHEN** 导出 Soul "V" + World "cyberpunk-2077"
- **THEN** 目录名 SHALL 为 `soulkiller:v-in-cyberpunk-2077`
- **AND** SKILL.md 的 name 字段为 `soulkiller:v-in-cyberpunk-2077`

#### Scenario: 用户调用

- **WHEN** 用户在 Claude Code 中输入 `/soulkiller:v-in-cyberpunk-2077`
- **THEN** SHALL 加载并运行该视觉小说 Skill

### Requirement: story-spec.md 状态系统规约

story-spec.md SHALL 包含状态系统规约段落，指导 Phase 1 的 LLM 在生成剧本时定义状态追踪机制。规约内容包括：数值轴（2-3 个，范围 0-10，初始值 5，名称须反映 Soul 人格特征）、关键事件标记（3-5 个布尔值，标记关键剧情节点）、选项状态影响标注格式。

#### Scenario: story-spec.md 包含状态系统段落

- **WHEN** `package_skill` 生成 story-spec.md
- **THEN** SHALL 包含 `## 状态系统` 段落
- **AND** 段落中定义数值轴规则（2-3 个，范围 0-10，初始 5）
- **AND** 段落中定义关键事件标记规则（3-5 个布尔值）
- **AND** 段落中定义选项影响标注格式（如 `trust +1, shared_secret = true`）

### Requirement: story-spec.md 结局判定规约

story-spec.md SHALL 包含结局判定规约段落，定义结局条件格式。每个结局 SHALL 定义由数值阈值和事件标记组合构成的触发条件。条件按优先级排列，最后一个结局 SHALL 为无条件默认结局。

#### Scenario: story-spec.md 包含结局判定段落

- **WHEN** `package_skill` 生成 story-spec.md
- **THEN** SHALL 包含 `## 结局判定` 段落
- **AND** 要求每个结局定义触发条件
- **AND** 要求条件按优先级排列
- **AND** 要求最后一个结局为无条件默认

### Requirement: SKILL.md 状态追踪规则

SKILL.md 的 Phase 2 规则 SHALL 新增状态追踪指令：Claude 必须在内部上下文中维护一个状态对象（包含 axes 和 flags），每次用户做出选择后根据剧本标注更新状态，状态不向用户展示。

#### Scenario: 选择后更新状态

- **WHEN** 用户在场景中选择了一个选项
- **AND** 该选项标注了 `trust +1, understanding +1`
- **THEN** Claude SHALL 在内部将 trust 和 understanding 各加 1

#### Scenario: 状态对用户不可见

- **WHEN** 故事正在运行中
- **THEN** Claude SHALL 不在任何场景输出中展示状态数值或事件标记

### Requirement: SKILL.md 结局判定规则

SKILL.md SHALL 指示 Claude 在到达结局阶段时，根据累积状态匹配结局条件。按优先级从高到低检查，第一个满足的条件触发对应结局。

#### Scenario: 状态满足最高优先级结局

- **WHEN** 故事到达结局阶段
- **AND** trust ≥ 7 且 shared_secret = true（满足 Ending A 条件）
- **THEN** Claude SHALL 触发 Ending A

#### Scenario: 状态不满足任何特定条件

- **WHEN** 故事到达结局阶段
- **AND** 没有任何特定结局条件被满足
- **THEN** Claude SHALL 触发默认结局（最后一个）

### Requirement: SKILL.md 结局展示三段式

SKILL.md SHALL 指示 Claude 在到达结局时按以下顺序展示：
1. 结局旁白和角色演绎
2. 旅程回顾：展示最终状态数值（用文本进度条可视化）和触发的关键事件
3. 其他可能的结局：每个列出标题、触发条件概述、一句预览文字

#### Scenario: 结局展示完整内容

- **WHEN** 触发 Ending A
- **THEN** Claude SHALL 先输出 Ending A 的旁白和角色演绎
- **THEN** 输出旅程回顾（状态数值进度条 + 关键事件列表）
- **THEN** 输出其他可能结局（Ending B/C/D 的标题 + 条件 + 预览）

#### Scenario: 旅程回顾格式

- **WHEN** 展示旅程回顾
- **THEN** 每个数值轴 SHALL 显示为 `{轴名} {进度条} {当前值}/10` 格式
- **AND** 关键事件 SHALL 显示为 `{事件名} ✓` 或 `{事件名} ✗`

### Requirement: SKILL.md 重玩选项

结局展示完成后，SKILL.md SHALL 指示 Claude 使用 AskUserQuestion 提供两个选项："从头再来"和"结束故事"。选择"从头再来"时，重置所有状态，回到 Phase 0（重新询问 seeds）。

#### Scenario: 从头再来

- **WHEN** 用户在结局后选择"从头再来"
- **THEN** Claude SHALL 重置状态对象（所有数值轴回到初始值，所有事件标记回到 false）
- **AND** 回到 Phase 0 重新询问 story seeds
- **AND** 基于新的 seeds（或无 seeds）重新生成剧本

#### Scenario: 结束故事

- **WHEN** 用户在结局后选择"结束故事"
- **THEN** 故事完结，不再输出任何内容
