## Context

当前 Soul 创建流程有 14 步状态机（type-select → name → description → tags → confirm → capturing → search-confirm → data-sources → source-path → ingesting → distilling → done），使用 `captureSoul()` + `SoulkillerProtocolPanel` 提供完整的 AI 搜索和视觉反馈。

World 创建流程（`WorldCreateWizard`）仅有 name → display-name → description → method-select（单选 manual/distill/url/blank）→ confirm → done。缺少 AI 搜索、Tag 系统、多数据源组合、蒸馏视觉面板。

现有 Soul 基础设施：
- `soul-capture-agent.ts`：使用 `ToolLoopAgent`（Vercel AI SDK），含 search/extractPage/planSearch/checkCoverage/reportFindings 5 个 tool
- `dimensions.ts`：6 个 Soul 维度 + 搜索模板 + coverage 分析
- `search-factory.ts`：创建 AI SDK tool 定义，支持 searxng/tavily/exa 多搜索后端
- `SoulkillerProtocolPanel`：实时展示 phase/tool call/search plan/classification

## Goals / Non-Goals

**Goals:**
- World 创建流程对齐 Soul 创建体验（AI 搜索 → 多数据源组合 → 蒸馏 → 审查）
- 通用化 capture agent 架构，Soul 和 World 共享搜索基础设施
- 建立 World 独立的 9 维度体系和 5 维度 Tag 系统
- Entry 引入 dimension 字段（与 scope 解耦）
- WorldManifest 补全缺失字段
- SoulkillerProtocolPanel 泛化支持 World capture

**Non-Goals:**
- 不改变现有 Soul 创建流程的行为（只提取共享部分）
- 不改变 context-assembler 的注入逻辑（scope 行为不变）
- 不改变 world binding/template/resolver 的行为
- 不改变搜索后端（searxng/tavily/exa）的实现
- 不引入新的外部依赖

## Decisions

### Decision 1：通用 Capture Agent 架构

**选择**：提取 `CaptureAgent` 通用类 + `CaptureStrategy` 接口，Soul 和 World 各实现一个策略。

```
src/agent/
├── capture-agent.ts          ← 新增：通用 agent 循环（ToolLoopAgent 配置、stream 消费、progress 发送）
├── capture-strategy.ts       ← 新增：CaptureStrategy 接口定义
├── soul-capture-strategy.ts  ← 从 soul-capture-agent.ts 提取 Soul 策略
├── world-capture-strategy.ts ← 新增：World 策略
├── soul-dimensions.ts        ← 重命名自 dimensions.ts
├── world-dimensions.ts       ← 新增：World 9 维度
└── tools/
    └── search-factory.ts     ← 不变，已经是通用的
```

**CaptureStrategy 接口：**
```typescript
interface CaptureStrategy {
  type: 'soul' | 'world'
  systemPrompt: string                          // Agent 的系统提示词
  buildUserMessage(name: string, hint?: string): string
  getClassificationLabels(): Record<string, string>
  getDimensionDefs(): Record<string, DimensionDef>
  generateSearchPlan(classification: string, englishName: string, localName: string, origin: string): SearchPlan
  analyzeCoverage(extractions: { content: string }[]): CoverageReport
  processResult(rawResult: RawCaptureResult): CaptureResult
}
```

**为什么不是继承**：策略模式更灵活，agent 循环逻辑完全共享（ToolLoopAgent 配置、stream 消费、doom loop 检测、progress 事件），只有提示词和维度不同。

**替代方案（已否决）**：直接在 `captureSoul` 里加 `if (mode === 'world')` 分支 → 会让函数膨胀，且 Soul/World 的系统提示词差异太大。

### Decision 2：World 9 维度体系

```typescript
type WorldDimension = 'geography' | 'history' | 'factions' | 'systems' | 'society' | 'culture' | 'species' | 'figures' | 'atmosphere'
```

**优先级：**
- REQUIRED（3）：geography, history, factions — 世界的骨架（空间+时间+势力）
- IMPORTANT（4）：systems, society, culture, species — 血肉
- SUPPLEMENTARY（2）：figures, atmosphere — 色彩

**Coverage 规则：**
- 最少覆盖 4 个维度（Soul 要求 3 个，World 更多是因为总维度数从 6 升到 9）
- 其中至少 2 个 REQUIRED

**dimension → scope 默认映射（蒸馏时自动分配）：**
```
geography  → background    history   → background
factions   → lore          systems   → rule
society    → lore          culture   → lore
species    → lore          figures   → lore
atmosphere → atmosphere
```

蒸馏 LLM 可以覆盖默认值（例如某个 geography entry 如果是"全世界最核心的三个地点"，可以设为 scope: background + mode: always）。

### Decision 3：World 类型与分类

**用户选择 WorldType（创建时）：**
```typescript
type WorldType = 'fictional-existing' | 'fictional-original' | 'real'
```

**流程分支：**
- `fictional-existing` → 走 AI Agent 搜索（搜索 wiki/百科/粉丝站）
- `fictional-original` → 跳过 AI 搜索，直接进入数据源选择
- `real` → 走 AI Agent 搜索（搜索新闻/百科/行业报告）

**Agent 分类 WorldClassification（搜索后）：**
```typescript
type WorldClassification = 'FICTIONAL_UNIVERSE' | 'REAL_SETTING' | 'UNKNOWN_SETTING'
```

**UNKNOWN_SETTING 处理：**
- 如果用户选了 `fictional-existing` → 提示"未找到相关信息，是否切换为原创模式？"
- 如果用户选了 `real` → 提示"未找到，是否换个关键词重试？"

### Decision 4：World Tag 系统

**独立于 Soul TagSet 的 WorldTagSet：**
```typescript
type WorldTagCategory = 'genre' | 'tone' | 'scale' | 'era' | 'theme'

interface WorldTagSet {
  genre: string[]    // 赛博朋克、奇幻、科幻、现实...
  tone: string[]     // 黑暗、轻松、史诗、荒诞...
  scale: string[]    // 行星级、大陆级、城市级、社区级...
  era: string[]      // 远未来、近未来、当代、古代、架空...
  theme: string[]    // 政治、科技、战争、日常、生存...
}
```

**为什么独立**：Soul Tag 的 5 个维度（personality/communication/values/behavior/domain）描述的是人格特征，与世界特征完全不同。复用同一个 TagSet 会导致维度名称语义不匹配。

**实现**：新建 `src/tags/world-taxonomy.ts`，复用 `src/tags/parser.ts` 的 LLM 解析逻辑（`parseTags` 函数已经是通用的，只需要传入不同的 category 列表和锚点词）。

### Decision 5：Entry dimension 字段

**选择**：在 EntryMeta 中添加可选 `dimension?: WorldDimension` 字段。

```yaml
---
name: night-city-districts
keywords: ["Watson", "Westbrook"]
priority: 800
mode: keyword
scope: lore
dimension: geography
---
```

**向后兼容**：dimension 可选，旧 entry 没有此字段时 `dimension` 为 `undefined`。蒸馏新生成的 entry 会自动带上 dimension。

**scope 与 dimension 的关系**：scope 控制注入行为（context-assembler.ts 不变），dimension 是语义分类（用于 UI 展示、coverage 分析、搜索引导）。同一个 dimension 的 entry 可以有不同的 scope。

### Decision 6：SoulkillerProtocolPanel 泛化

**选择**：将 panel 的 Props 泛化，通过 `mode: 'soul' | 'world'` 切换显示。

```typescript
interface CaptureProtocolPanelProps {
  mode: 'soul' | 'world'
  targetName: string
  classification?: string              // 统一为 string（Soul 和 World 的分类值不同）
  classificationLabels: Record<string, string>  // 由调用方传入
  origin?: string
  toolCalls: ToolCallDisplay[]
  totalFragments?: number
  elapsedTime?: number
  filterProgress?: { kept: number; total: number }
  phase: AgentPhase
  searchPlan?: SearchPlanDimDisplay[]
}
```

**变化最小化**：组件内部逻辑基本不变，只是 classification 标签从硬编码改为 props 传入。标题文案根据 mode 切换（Soul: "SOULKILLER PROTOCOL" / World: "WORLDFORGE PROTOCOL"）。

### Decision 7：WorldManifest 扩展

```typescript
interface WorldManifest {
  // 现有字段不变
  name: string
  display_name: string
  version: string
  created_at: string
  description: string
  entry_count: number
  defaults: WorldDefaults

  // 新增字段
  worldType: WorldType
  classification?: WorldClassification
  tags: WorldTagSet
  sources?: { type: string; path_or_url?: string }[]
  origin?: string
  evolve_history?: WorldEvolveHistoryEntry[]
}
```

**向后兼容**：`loadWorld()` 读取旧格式 manifest 时，缺失字段使用默认值（worldType: 'fictional-existing'、tags: emptyWorldTagSet()、evolve_history: []）。

### Decision 8：WorldCreateWizard 状态机

```
type-select → name → name-conflict? → display-name → description → tags → confirm
  → data-sources（前置于搜索，控制是否启用 AI 搜索）
  → [if web-search] capturing → search-confirm（按维度展示搜索结果）
  → [if markdown/url] source-path
  → distilling（WorldDistillPanel 四阶段可视化）
  → review → creating → bind-prompt? → done
```

```typescript
type WorldCreateStep =
  | 'type-select'       // 选择 fictional-existing / fictional-original / real
  | 'name'
  | 'name-conflict'     // 冲突处理：覆盖（重建）或补充（追加数据到已有世界）
  | 'display-name'
  | 'description'
  | 'tags'              // World Tags 输入 + LLM 解析
  | 'confirm'           // 摘要确认
  | 'data-sources'      // 多数据源选择（前置于搜索）
  | 'capturing'         // AI Agent 搜索中（仅勾选了 web-search 时）
  | 'search-confirm'    // 搜索结果确认 + 按维度展示（维度柱状条）
  | 'source-path'       // 逐个收集非 web-search 数据源路径
  | 'distilling'        // 蒸馏（WorldDistillPanel：摄入→维度分类→聚类→条目生成）
  | 'review'            // 蒸馏结果审查
  | 'creating'          // 写入文件系统
  | 'bind-prompt'       // 引导绑定到当前 Soul（如有）
  | 'done'
  | 'error'
```

**关键设计决策：**
- 数据源选择**前置于 AI 搜索**——用户先选数据源，选了 web-search 才触发 AI 搜索
- `fictional-original` 类型不显示 web-search 选项（没有公开资料可搜）
- 同名冲突提供**覆盖**和**补充**两个选项。补充模式加载现有 manifest，跳过基本信息收集，直接进入数据源选择，新 entries 追加到已有世界
- search-confirm 步骤**按 9 个维度展示搜索结果分布**（维度名+数量柱状条+优先级标签）
- 蒸馏使用 **WorldDistillPanel** 展示四阶段进度：数据摄入→维度分类（含维度统计）→语义聚类→条目生成（逐个展示 entry 名称和维度）

## Risks / Trade-offs

**[Risk] CaptureAgent 重构可能破坏现有 Soul 创建** → 重构后保持 `captureSoul()` 函数签名不变（内部委托给通用 agent + soul strategy），现有调用方无需修改。所有现有测试必须继续通过。

**[Risk] 9 维度的 Agent 搜索耗时更长** → World 的 MAX_STEPS 可以设为 35（Soul 是 30），因为维度更多。同时 SUPPLEMENTARY 维度（figures/atmosphere）不要求覆盖，Agent 可以在 REQUIRED + IMPORTANT 满足后提前 report。

**[Risk] WorldTagSet LLM 解析质量** → 复用已验证的 Soul tag 解析架构（parseTags），只替换 category 和锚点词。如果 LLM 给出的 tag 不在锚点词列表中，保留用户原始输入（与 Soul 行为一致）。

**[Trade-off] SoulkillerProtocolPanel 泛化 vs 新建** → 选择泛化（加 mode prop），虽然增加了组件复杂度，但避免了两份几乎相同的 UI 代码。如果后续两者 UI 差异变大，可以再分离。

**[Trade-off] dimension 字段可选** → 向后兼容更好，但意味着旧 entry 没有 dimension 标注。可以在 `/world evolve` 时让蒸馏自动补全旧 entry 的 dimension，但这不在本次 scope 内。
