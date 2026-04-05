## Context

当前 agent loop 使用 ToolLoopAgent + 3 个 tool（search、extractPage、reportFindings），LLM 完全自主决定搜索内容和停止时机。实践发现 LLM 倾向于搜到身份信息后就 report，缺少台词、性格、行为模式等构建灵魂所必需的深层数据。

distill 阶段产出 identity.md / style.md / behaviors/*.md，搜索阶段应为这些输出收集充足的原材料。需要在 agent 中建立「灵魂信息维度」的概念，引导搜索覆盖所有关键维度。

## Goals / Non-Goals

**Goals:**
- 定义灵魂的 6 维度模型，作为搜索完整性的衡量标准
- 通过 planSearch tool 为 LLM 提供分类特定的搜索计划（维度 + 信息源 + 推荐查询）
- 通过 checkCoverage tool 让 LLM 知道哪些维度还缺数据
- 用 prepareStep 实现侦察→规划→采集的阶段控制
- 至少覆盖 3/6 维度 + 必需维度 2/3 才允许 report

**Non-Goals:**
- 不改变 LLM provider 或模型配置
- 不改变 distill 流程（只改搜索阶段）
- checkCoverage 不使用 LLM 判断，纯系统逻辑
- 不做搜索结果的语义去重（保持现有 webExtractionToChunks 逻辑）

## Decisions

### 1. 6 维度模型

```typescript
type SoulDimension = 'identity' | 'quotes' | 'expression' | 'thoughts' | 'behavior' | 'relations'

const DIMENSIONS: Record<SoulDimension, {
  priority: 'required' | 'important' | 'supplementary'
  description: string
  distillTarget: string  // 对应的 distill 输出
}> = {
  identity:   { priority: 'required',      description: '身份背景、来历、所属世界/组织', distillTarget: 'identity.md' },
  quotes:     { priority: 'required',      description: '台词、语录、名言、口头禅、直接引用', distillTarget: 'style.md' },
  expression: { priority: 'required',      description: '说话风格、语气、用词偏好、修辞习惯', distillTarget: 'style.md' },
  thoughts:   { priority: 'important',     description: '价值观、信念、立场、人生哲学', distillTarget: 'behaviors/' },
  behavior:   { priority: 'important',     description: '决策模式、面对冲突的反应、习惯性行为', distillTarget: 'behaviors/' },
  relations:  { priority: 'supplementary', description: '重要关系、对不同人的态度、社交风格', distillTarget: 'behaviors/' },
}
```

**理由**: 直接对齐 distill 的输出结构，确保搜索阶段收集的数据能覆盖下游需求。required 维度缺失会导致灵魂不完整（没有声音、不知道是谁）。

### 2. planSearch — 确定性查表，不用 LLM

**选择**: planSearch 的 execute 函数按 `classification × dimension` 查表生成搜索计划

**替代**: 让 LLM 自己规划搜索
**理由**: 搜索计划是确定性知识（虚构角色的台词去 fandom wiki 搜），不需要 LLM 推理。查表更快、更稳定、可维护。

**信息源映射表（按分类）：**

```
DIGITAL_CONSTRUCT:
  identity    → wikipedia(en, zh), web("NAME ORIGIN wiki")
  quotes      → web("NAME quotes dialogue"), web("NAME 台词 语录")
  expression  → web("NAME speech patterns"), web("NAME 说话风格 口头禅")
  thoughts    → web("NAME values beliefs ideals"), web("NAME 价值观 信念")
  behavior    → web("NAME decisions personality"), web("NAME 性格 行为")
  relations   → web("NAME relationships"), web("NAME 人物关系")

PUBLIC_ENTITY:
  identity    → wikipedia(en, zh), web("NAME biography")
  quotes      → web("NAME famous quotes interviews"), web("NAME 经典语录 发言")
  expression  → web("NAME communication style"), web("NAME 说话风格 演讲特点")
  thoughts    → web("NAME philosophy beliefs opinions"), web("NAME 观点 立场")
  behavior    → web("NAME leadership decision making"), web("NAME 处事方式")
  relations   → web("NAME key relationships"), web("NAME 重要关系 合作")

HISTORICAL_RECORD:
  identity    → wikipedia(en, zh, ja), web("NAME biography legacy")
  quotes      → web("NAME famous quotes attributed"), web("NAME 名言 语录")
  expression  → web("NAME writing style rhetoric"), web("NAME 文风 修辞")
  thoughts    → web("NAME philosophy core ideas"), web("NAME 思想 哲学")
  behavior    → web("NAME decisions historical accounts"), web("NAME 历史事迹")
  relations   → web("NAME contemporaries influence"), web("NAME 交往 影响")
```

planSearch 返回格式:
```typescript
{
  classification: 'DIGITAL_CONSTRUCT',
  englishName: 'Artoria Pendragon',
  dimensions: [
    {
      dimension: 'identity',
      priority: 'required',
      queries: [
        { source: 'wikipedia', query: 'Artoria Pendragon', lang: 'en' },
        { source: 'wikipedia', query: '阿尔托莉雅·潘德拉贡', lang: 'zh' },
        { source: 'web', query: 'Artoria Pendragon Fate Stay Night wiki' },
      ]
    },
    {
      dimension: 'quotes',
      priority: 'required',
      queries: [
        { source: 'web', query: 'Artoria Pendragon quotes dialogue' },
        { source: 'web', query: '阿尔托莉雅 台词 语录 名言' },
      ]
    },
    // ... 其他维度
  ]
}
```

### 3. checkCoverage — 关键词匹配 + 内容长度

**选择**: 纯系统逻辑，不用 LLM

**实现**:
每个维度定义一组关键词，扫描已有 extractions 的 content 来判断是否命中：

```typescript
const DIMENSION_SIGNALS: Record<SoulDimension, { patterns: RegExp[] }> = {
  identity: { patterns: [/background|biography|born|是|来自|角色|character/i] },
  quotes:   { patterns: [/said|says|quote|"[^"]{10,}"|「[^」]+」|台词|语录|名言/i] },
  expression: { patterns: [/style|tone|manner|speaks|口头禅|语气|说话方式/i] },
  thoughts: { patterns: [/believes?|values?|philosophy|观点|信念|价值观|理念/i] },
  behavior: { patterns: [/decision|react|habit|pattern|personality|性格|行为|决策/i] },
  relations: { patterns: [/relationship|friend|rival|ally|关系|朋友|对手/i] },
}
```

一条 extraction 可以命中多个维度。返回格式：
```typescript
{
  coverage: {
    identity: { count: 3, covered: true },
    quotes: { count: 0, covered: false },
    expression: { count: 1, covered: true },
    thoughts: { count: 0, covered: false },
    behavior: { count: 2, covered: true },
    relations: { count: 0, covered: false },
  },
  totalCovered: 3,
  requiredCovered: 2,  // identity + expression
  canReport: true,     // 3/6 ≥ 3 且 required 2/3 ≥ 2
  suggestion: "Still missing: quotes (台词/语录), thoughts (价值观/信念), relations (人物关系). Consider searching for quotes and dialogue."
}
```

### 4. 三阶段 prepareStep 控制

```
Phase 1: 侦察 (step 0-1)
  activeTools: ['search']
  → LLM 只能搜索，不能规划或报告

Phase 2: 规划 (step 2)
  activeTools: ['planSearch']
  toolChoice: { type: 'tool', toolName: 'planSearch' }
  → 强制调用 planSearch

Phase 3: 采集 (step 3+)
  activeTools: ['search', 'extractPage', 'checkCoverage', 'reportFindings']
  → 全部工具可用，LLM 自主搜索 + 检查覆盖 + 报告
```

阶段 2 到阶段 3 是自动的（planSearch 执行完后下一步进入采集）。阶段 3 内 LLM 可以自由决定何时 checkCoverage、何时 reportFindings。

### 5. reportFindings extractions 新增 dimension 标注

```typescript
extractions: [{
  content: string,
  url?: string,
  searchQuery: string,
  dimension: SoulDimension,  // 新增
}]
```

LLM 在 report 时标注每条 extraction 属于哪个维度。这个信息后续可以传递给 distill 阶段优化提取。

### 6. system prompt 更新要点

- 加入 6 维度模型描述，让 LLM 理解灵魂需要哪些信息
- planSearch 返回的搜索计划会自动注入到对话中，LLM 据此搜索
- 终止条件从 "8+ substantial pieces" 改为 "覆盖 3+ 维度且必需维度至少 2 个"
- 引导 LLM 在搜索几轮后主动调用 checkCoverage 查看进度

## Risks / Trade-offs

**[关键词匹配的精度]** checkCoverage 用正则匹配判断维度覆盖，可能有误判（false positive/negative） → 可接受，因为这只是引导信号而非硬性阻断。LLM 看到 coverage report 后自己判断是否继续搜

**[搜索次数增加]** 维度驱动会比当前多搜 3-5 次 → 这正是我们要的效果，信息更完整

**[planSearch 查表的维护成本]** 每种分类需要维护维度×信息源映射 → 集中在 dimensions.ts 一个文件中，易于维护和扩展

**[LLM 可能忽略 plan]** 即使 planSearch 给了推荐查询，LLM 可能不完全遵循 → checkCoverage 作为兜底，告诉它哪些维度还缺
