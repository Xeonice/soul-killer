## Context

Soul 采集和蒸馏管线沿着维度模型运作：`soul-dimensions.ts` 定义搜索维度 → capture agent 按维度搜索并标记 chunks → distill agent 按维度采样 chunks 并写入对应文件。新增维度需要贯穿这条完整管线。

现有 8 个维度的蒸馏对应关系：identity → identity.md，quotes + expression → style.md，thoughts + behavior + relations → behaviors/\*.md。

## Goals / Non-Goals

**Goals:**
- 新增 capabilities 和 milestones 维度，贯穿搜索→蒸馏→导出全链路
- 按 classification 差异化搜索模板（虚构角色搜能力/装备，真实人物搜专业技能/方法论）
- capabilities.md 统一覆盖：知识型、技能型、属性型、装备型、系统型能力
- milestones.md 提供结构化时间线，为 Era 系统提供切分素材
- 向后兼容：旧 Soul 没有新文件时不影响任何现有功能

**Non-Goals:**
- 不实现 Era 系统本身（仅准备前置数据）
- 不修改 World 维度模型
- 不重新蒸馏现有 Soul（用户可通过 /evolve 手动触发）

## Decisions

### Decision 1: capabilities 维度定义

**优先级**: important（与 thoughts / behavior 同级）
**蒸馏目标**: `capabilities.md`
**描述**: 能力、技能、属性数值、装备、专业知识

**信号正则**:
```
/abilities|powers|skills|stats|weapons|equipment|noble phantasm/i
/能力|技能|属性|宝具|武器|装备|法术|专精|方法论/
```

**搜索模板（按 classification）**:
- DIGITAL_CONSTRUCT: `"{name} abilities powers skills stats"`, `"{name} weapons equipment noble phantasm"`, `"{localName} 能力 技能 属性 宝具 武器"`
- PUBLIC_ENTITY: `"{name} expertise methodology core skills"`, `"{localName} 专业能力 方法论 核心技能"`
- HISTORICAL_RECORD: `"{name} skills achievements expertise legacy"`, `"{localName} 才能 成就 专长"`

### Decision 2: milestones 维度定义

**优先级**: important
**蒸馏目标**: `milestones.md`
**描述**: 关键事件时间线、转折点、成长阶段、标志性成就

**信号正则**:
```
/timeline|key events|turning point|milestone|major battle|arc\b/i
/时间线|关键事件|转折点|里程碑|重大战役|经历|编年/
```

**搜索模板（按 classification）**:
- DIGITAL_CONSTRUCT: `"{name} timeline key events story arc"`, `"{name} {origin} major battles turning points"`, `"{localName} 时间线 关键事件 经历"`
- PUBLIC_ENTITY: `"{name} career timeline key decisions milestones"`, `"{localName} 生涯 时间线 关键决策"`
- HISTORICAL_RECORD: `"{name} chronology major events legacy timeline"`, `"{localName} 编年 大事记 历史事件"`

### Decision 3: 蒸馏 system prompt 新增

distill agent 的 Output Files 新增：

```
- **capabilities.md** — What they can do: abilities, skills, stats, equipment, expertise.
  For fictional characters: power systems, attribute values, weapons, combat techniques.
  For real people: professional skills, methodologies, key competencies.

- **milestones.md** — What happened to them: structured timeline of key events.
  Each entry: [time marker] event description → impact on character state.
  Events should be in chronological order with causal relationships noted.
```

Recommended Workflow 新增步骤：
```
3.5. writeCapabilities based on abilities/skills/equipment data
3.7. writeMilestones based on timeline/events data — use structured format
```

### Decision 4: milestones.md 的结构化格式

milestones.md 采用统一的时间线格式，方便未来 Era 系统解析：

```markdown
# Milestones

## [时间标记] 事件标题
事件描述...
→ 角色状态变化 / 影响

## [时间标记] 事件标题
事件描述...
→ 角色状态变化 / 影响
```

时间标记可以是具体年份、相对时间（"幼年"/"15岁"）、或作品内时间（"第一幕"/"圣杯战争期间"）。

### Decision 5: readSoulFiles 和 export 的扩展

`readSoulFiles()` 返回类型新增 `capabilities: string` 和 `milestones: string`，不存在时返回空字符串（向后兼容）。

export 的 `skill-template.ts` Phase 1 新增读取指令，Phase 2 新增引用规则：
- "当用户问及能力/技能/装备时，参考 capabilities.md"
- "当用户问及经历/过去事件时，参考 milestones.md"
- "角色只知道 milestones.md 中记录的事件"

### Decision 6: Tag 感知搜索

`generateSearchPlan` 函数签名新增 `tags?: TagSet` 参数。搜索模板生成时，domain tags 被用于动态扩展查询词。

**实现机制**：

```typescript
// 现有: 只用 classification × dimension 选模板
generateSearchPlan(classification, englishName, localName, origin)

// 新增: tags 参数影响查询生成
generateSearchPlan(classification, englishName, localName, origin, tags?)
```

**影响范围按维度**：

| 维度 | tag 影响 | 机制 |
|------|---------|------|
| capabilities | **强制扩展** | domain tags 追加为搜索关键词（如 domain=["骑士"] → 追加 "knight sword"） |
| milestones | **强制扩展** | domain tags 影响事件类型关键词（如 domain=["企业家"] → 追加 "business career"） |
| thoughts | **可选追加** | domain tags 追加到现有查询末尾 |
| behavior | **可选追加** | domain tags 追加到现有查询末尾 |
| identity / quotes / expression / relations | **不变** | 这些维度的搜索不受 tags 影响 |

**扩展逻辑**：将 domain tags 拼接为空格分隔的关键词字符串 `tagHint`，追加到模板查询末尾。如果 domain tags 为空，退回到纯 classification 模板（向后兼容）。

```
示例:
  domain = ["骑士", "剑术"]
  tagHint = "骑士 剑术"

  capabilities 模板 (DIGITAL_CONSTRUCT):
    原始: "{name} abilities powers skills stats"
    扩展: "{name} abilities powers skills 骑士 剑术"
    追加: "{localName} 能力 技能 骑士 剑术"
```

**调用方**：`soul-capture-agent.ts` 在调用 `generateSearchPlan` 时传入已有的 tags（从 manifest 或 create 流程获取）。如果没有 tags（旧 Soul 或未设置），传 undefined，退回到纯 classification 模板。

### Decision 7: 覆盖度阈值调整

MIN_TOTAL_COVERED 从 3 提升到 4（8 维度中至少覆盖 4 个才能 report）。
REQUIRED_DIMENSIONS 新增 capabilities（identity / quotes / expression / capabilities 为 required）。

## Risks / Trade-offs

- **[搜索成本增加]** 8 维度比 6 维度多 2 组搜索查询 → 缓解：capabilities 和 milestones 的搜索结果往往与 identity 有重叠（wiki 页面），实际额外请求数有限
- **[蒸馏步骤增加]** distill agent 多写 2 个文件 → 缓解：maxSteps 可能需要微调，但新文件通常不长
- **[旧 Soul 兼容性]** 已蒸馏的 Soul 没有 capabilities.md / milestones.md → 缓解：所有读取逻辑对缺失文件返回空字符串，不影响现有功能。用户可通过 /evolve 触发重新蒸馏
