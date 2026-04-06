# Cloud Skill Format

## ADDED Requirements

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

## MODIFIED Requirements

### Requirement: SKILL.md 视觉小说引擎模板

SKILL.md SHALL 作为视觉小说引擎的调度器 prompt，包含 YAML frontmatter 和三阶段运行指令。

#### Scenario: SKILL.md frontmatter

- **WHEN** SKILL.md 生成
- **THEN** frontmatter 的 `name` 字段 SHALL 使用 `soulkiller:{soul}-in-{world}` 格式
- **AND** 包含 `description` 和 `allowed-tools: Read`

### Requirement: 导出物命名规则

导出物目录名 SHALL 遵循 `soulkiller:{soul-name}-in-{world-name}` 格式。输出路径由用户在导出流程中选择。

#### Scenario: 标准命名

- **WHEN** 导出 Soul "V" + World "cyberpunk-2077"
- **THEN** 目录名 SHALL 为 `soulkiller:v-in-cyberpunk-2077`
- **AND** SKILL.md 的 name 字段为 `soulkiller:v-in-cyberpunk-2077`

#### Scenario: 用户调用

- **WHEN** 用户在 Claude Code 中输入 `/soulkiller:v-in-cyberpunk-2077`
- **THEN** SHALL 加载并运行该视觉小说 Skill
