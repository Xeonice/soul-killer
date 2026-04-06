export interface StorySpecConfig {
  genre: string
  tone: string
  acts: number
  endings_min: number
  rounds: string
  constraints: string[]
}

export function generateStorySpec(config: StorySpecConfig): string {
  const { genre, tone, acts, endings_min, rounds, constraints } = config

  const constraintsBlock = constraints.length > 0
    ? `\n## 额外约束\n\n${constraints.map((c) => `- ${c}`).join('\n')}\n`
    : ''

  return `---
genre: ${genre}
tone: ${tone}
acts: ${acts}
endings_min: ${endings_min}
rounds: ${rounds}
---

# Seeds

此处由 Skill 运行时 Phase 0 收集的用户 seeds 动态填充。
如果用户选择"让命运来决定"，则此段为空，完全随机生成。

# 剧本生成规约

## 结构要求

- ${acts} 幕结构，每幕 2-4 个场景
- 至少 ${endings_min} 个不同结局
- 总交互轮数控制在 ${rounds} 轮
- 每个场景结尾必须有 2-3 个选项

## 场景格式

每个场景必须包含：

\`\`\`
[narration]
第二人称沉浸式旁白，描述环境、氛围、角色状态。

[character: {角色名}]
state: 角色当前的情绪/身体状态
attitude: 对用户的态度
key_info: 本场景必须透露的关键信息
tone: 对话的情绪基调

[choices]
- "选项文字" -> scene:{下一场景ID} | {状态影响}
- "选项文字" -> scene:{下一场景ID} | {状态影响}
\`\`\`

状态影响格式示例：\`trust +1, understanding +2\` 或 \`shared_secret = true\`

## 叙事约束

- 基调为「${genre}」，整体风格为「${tone}」
- 开场必须自然引入角色与用户的相遇
- 选项必须产生实质性的剧情分歧，不能殊途同归
- 结局之间要有明显的情感差异
- 世界观元素要自然融入场景，不要说教式展示

## 角色约束

- 角色行为必须符合 soul/identity.md 中的人格描述
- 说话方式必须符合 soul/style.md
- 角色不会无条件信任用户，信任需要通过选择建立

## 状态系统

剧本必须定义以下状态追踪机制：

### 数值轴（2-3 个）
根据角色人格和世界观设计，每个轴范围 0-10，初始值 5。
轴名称必须反映角色的核心人格特征（如 trust、understanding、bond），不要使用通用名称。

### 关键事件标记（3-5 个）
布尔值，标记玩家是否触发了关键剧情节点。
事件名称必须对应剧情中的具体转折点（如 shared_secret、confronted_past）。

### 选项状态影响
每个场景的 [choices] 必须标注该选择对状态的影响（数值变化和/或事件触发）。
不同选项应该对状态产生不同方向的影响，避免所有选项都加同一个轴。

## 结局判定

每个结局必须定义触发条件，由数值阈值和事件标记组合构成。
条件按优先级从高到低排列，第一个满足的触发。
**最后一个结局必须是无条件默认结局**（兜底）。

格式：
\`\`\`
Ending A: {标题}
  条件: trust >= 7 AND shared_secret = true

Ending B: {标题}
  条件: understanding >= 7

Ending C: {标题}
  条件: (默认)
\`\`\`

## 结局展示

每个结局必须包含：
1. 结局旁白和角色演绎（与普通场景格式一致）
2. 旅程回顾数据：列出最终的数值轴值和触发的事件标记
3. 所有其他结局的预览：标题 + 触发条件概述 + 一句预览文字

## 幕间过渡

- 每次 Act 切换必须有过渡旁白（总结上一幕情绪余韵）
- 过渡后附带一个反思性选择（不影响剧情走向，影响下一幕情绪入口）

## 禁止

- 不要生成超过 ${acts * 5} 个场景
- 不要生成单选项场景（死路）
- 不要在前两幕就出现结局分支
- 不要让角色主动打破第四面墙
${constraintsBlock}`
}
