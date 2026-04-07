## ADDED Requirements

### Requirement: 多角色好感度状态系统
导出的 SKILL.md 引擎 SHALL 维护 per-character 多轴好感度状态。

#### Scenario: 状态对象结构
- **WHEN** 故事引擎初始化状态
- **THEN** SHALL 创建 `{ affinity: { "角色名": { 轴名: 初始值 } }, flags: {} }` 结构
- **AND** 每个角色的轴名称和初始值 SHALL 来自 story-spec.md 的 characters 定义

#### Scenario: 选项影响好感度
- **WHEN** 用户做出选择
- **THEN** 该选项 SHALL 同时影响在场多个角色的好感轴
- **AND** 不同选项 SHALL 对不同角色产生差异化影响（tradeoff）

#### Scenario: 好感度驱动结局
- **WHEN** 故事到达结局判定阶段
- **THEN** SHALL 根据多角色好感轴的组合条件匹配结局
- **AND** 条件按优先级从高到低检查，第一个满足的触发
- **AND** 最后一个结局 SHALL 为无条件默认结局

### Requirement: 多角色同框场景调度
SKILL.md 引擎 SHALL 支持多角色在同一场景中出场和对话。

#### Scenario: 场景 cast 编排
- **WHEN** 剧本定义一个场景
- **THEN** SHALL 指定在场角色列表（cast）及各角色当前状态
- **AND** 不在场角色的好感轴不受该场景选项影响

#### Scenario: 多角色对话
- **WHEN** 场景中有多个角色在场
- **THEN** 引擎 SHALL 按剧本编排交替展现不同角色的对话
- **AND** 每个角色的语言风格 SHALL 遵循对应 soul 的 style.md

#### Scenario: 角色延迟出场
- **WHEN** 角色的 `appears_from` 设定为非第一幕
- **THEN** 该角色 SHALL 不出现在设定幕数之前的场景中
- **AND** 首次出场 SHALL 有自然引入

### Requirement: 结局图鉴
故事结束后 SHALL 展示结局总览。

#### Scenario: 达成结局展示
- **WHEN** 故事到达结局
- **THEN** SHALL 展示：结局旁白 + 角色演绎
- **AND** SHALL 展示旅程回顾：每个角色每个轴的进度条（█/░ 格式）+ 关键事件标记（✓/✗）
- **AND** SHALL 展示所有其他结局：标题 + 触发条件 + 一句预览

#### Scenario: 重玩选项
- **WHEN** 结局图鉴展示完毕
- **THEN** SHALL 提供"从头再来"和"结束故事"选项
- **AND** "从头再来" SHALL 完全重置状态，回到 Phase 0

### Requirement: 角色数量限制
单次导出 SHALL 限制最多 4 个角色。

#### Scenario: 选中的 soul 超过 4 个
- **WHEN** 用户选中的 soul 数量超过 4 个
- **THEN** 上层应提示限制，只保留前 4 个有效 soul（具体筛选规则由上层流程决定）

#### Scenario: 角色数量与叙事结构
- **WHEN** 角色数 ≤ 2
- **THEN** SHALL 推荐 3 幕、4+ 结局
- **WHEN** 角色数 3-4
- **THEN** SHALL 推荐 4 幕、5+ 结局

### Requirement: story-spec 多角色扩展
story-spec.md SHALL 支持多角色编排定义。

#### Scenario: characters 数组
- **WHEN** 生成 story-spec.md
- **THEN** YAML front matter SHALL 包含 `characters` 数组
- **AND** 每个 character SHALL 有 name、role、axes（含 name/english/initial）、appears_from

#### Scenario: 选项 tradeoff 约束
- **WHEN** story-spec 定义选项规则
- **THEN** SHALL 约束每个选项必须对不同角色产生差异化好感影响
- **AND** SHALL 禁止所有选项对所有角色产生相同方向的影响
