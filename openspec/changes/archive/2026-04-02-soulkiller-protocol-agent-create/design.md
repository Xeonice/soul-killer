## Context

Soulkiller 是 Cyberpunk 2077 风格的 REPL，当前 /create 流程是纯手动的（选数据源 → 输入路径）。需要改为 agent-first：用户输入名字，agent 自动判断人物类型并从互联网采集数据，失败时才回退手动模式。使用 Vercel AI SDK 实现 agent，通过 OpenRouter 调 LLM。

## Goals / Non-Goals

**Goals:**
- 用户只输入一个名字，零其他操作即可创建虚构角色/公众人物的分身
- Agent 自动判断人物类型，无需用户确认
- 采集过程展示 Soulkiller Protocol 风格的动画面板
- Agent 输出标准 SoulChunk[]，与手动采集路径完全合流
- 搜索不到足够数据时，优雅回退到手动数据源选择
- Tavily API key 可选——没有 key 时直接走手动模式

**Non-Goals:**
- 飞书/钉钉/Slack 企业 IM 自动采集（后续 change）
- 微信聊天记录采集
- Agent 的对话纠正机制（"他不会这样说"）
- 增量进化（追加数据后自动 merge）

## Decisions

### D1: Agent 框架 — Vercel AI SDK

**选择**: `ai` npm 包 + `@ai-sdk/openai` provider
**替代**: LangGraph (Python), LangChain.js, 自研
**理由**:
- Node.js 原生，与现有 TypeScript 项目一致
- OpenAI SDK 兼容 → 通过 OpenRouter baseURL 直接用
- `generateText` + tools 模式天然适合多步搜索 agent
- 不引入 Python 依赖

### D2: 搜索工具链 — Tavily / WebSearch 降级 + Wikipedia

搜索能力分三层，按优先级降级：

```
有 Tavily key → tavily_search（最优，结构化结果）
无 Tavily key → web_search（通用 web 搜索，通过 fetch 抓取）
Wikipedia    → 始终可用（免费，无需 key）
```

**Tavily Search**（首选）:
- 为 AI agent 设计的搜索 API，返回结构化结果
- 用于：身份识别、性格分析、补充信息、台词/对话采集
- 通过 Vercel AI SDK 的 tool 机制调用

**WebSearch**（Tavily 不可用时的降级）:
- 通用 web 搜索工具，无需额外 API key
- 搜索质量略低于 Tavily，但足以完成身份识别和基础采集
- Agent 内部通过统一的 search tool 接口调用，无感切换

**Wikipedia API**（始终可用）:
- 免费、无需 key、结构化
- 用于：基础信息（生平、背景、关键事件）
- 直接 HTTP fetch，不需要额外依赖

**Agent 内部不关心用的是 Tavily 还是 WebSearch**——两者都实现同一个 tool interface（query → results），在 agent 初始化时根据 config 决定注入哪个。

### D3: 人物类型自动判断

Agent 的第一个 tool call 搜索 "{name} 是谁"，LLM 从搜索结果中判断类型：

```typescript
type TargetClassification =
  | 'DIGITAL_CONSTRUCT'  // 虚构角色（游戏/动漫/电影/小说）
  | 'PUBLIC_ENTITY'      // 公众人物（科技/商业/文化）
  | 'HISTORICAL_RECORD'  // 历史人物
  | 'UNKNOWN_ENTITY'     // 搜索不到 → 回退手动模式
```

判断逻辑在 LLM prompt 中定义，不是规则匹配。

### D4: Agent 工作流（4 步）

```
Step 1: identify
  tool: tavily_search("{name} 是谁 who is")
  LLM → classification + origin/domain

Step 2: gather_base
  tool: wikipedia_search("{name}")
  LLM → 提取基础信息 → SoulChunk[] (knowledge 类)

Step 3: gather_deep (策略因类型而异)
  DIGITAL_CONSTRUCT →
    tavily_search("{name} {origin} quotes dialogue 台词 经典语录")
    tavily_search("{name} character analysis 角色设定")
  PUBLIC_ENTITY →
    tavily_search("{name} interview speech 演讲 观点")
    tavily_search("{name} opinion technology views")
  HISTORICAL_RECORD →
    tavily_search("{name} famous quotes philosophy 名言 思想")
    tavily_search("{name} works writings 著作")
  LLM → 提取观点/台词/行为 → SoulChunk[] (opinion/casual 类)

Step 4: personality
  tavily_search("{name} personality MBTI 性格 说话风格")
  LLM → 提取性格特征 → SoulChunk[] (reflection 类)
```

每步结束后 LLM 把搜索结果转为 SoulChunk[]（方案 A）。

### D5: UNKNOWN_ENTITY 回退

如果 Step 1 的搜索结果过少或 LLM 无法判断类型：
- classification 设为 UNKNOWN_ENTITY
- Agent 停止，返回空 SoulChunk[]
- /create 流程检测到空结果，显示 "MANUAL EXTRACTION REQUIRED"
- 自动进入手动数据源选择（现有流程）

### D6: Soulkiller Protocol Panel — 动画设计

```
┌─ SOULKILLER PROTOCOL ─────────────────────┐
│                                            │
│  ▓ initiating soul capture...              │  ← Phase 1: glitch 文字
│                                            │
│  ▓ target acquired: 强尼银手               │  ← Phase 2: 逐行 reveal
│    classification: DIGITAL CONSTRUCT       │
│    origin: Cyberpunk 2077                  │
│                                            │
│  ▓ extracting neural patterns...           │  ← Phase 3: 每完成一步显示
│    ▸ core identity............... ✓        │
│    ▸ behavioral signatures....... ✓        │
│    ▸ dialogue fragments.......... ⠋        │  ← 当前步骤 spinner
│                                            │
│  ▓ soul fragments captured: 47             │  ← Phase 4: 完成统计
│    extraction time: 12.3s                  │
│                                            │
└────────────────────────────────────────────┘
```

- 边框 cyan，标题 `SOULKILLER PROTOCOL` magenta
- classification 用 Cyberpunk 术语
- 进行中的步骤显示 spinner（⠋⠙⠹⠸⠼⠴⠦⠧⠇⠏ braille）
- 完成的步骤显示 ✓

### D7: SoulChunk source 标记

Agent 产生的 chunks 的 source 字段：

```typescript
// 新增 source 类型
type SourceType = 'markdown' | 'twitter' | 'web' | ...

// web adapter 输出的 chunk
{
  source: 'web',
  metadata: {
    url: 'https://en.wikipedia.org/wiki/...',
    search_query: '强尼银手 角色设定',
    extraction_step: 'gather_deep',
  }
}
```

### D8: Config 扩展

```yaml
# ~/.soulkiller/config.yaml
llm:
  provider: openrouter
  api_key: sk-or-xxx
  default_model: google/gemini-2.5-flash
search:
  tavily_api_key: tvly-xxx  # 可选，有则用 Tavily，无则用 WebSearch
```

Setup wizard 中新增可选的 Tavily key 输入步骤。**无论有没有 Tavily key，agent 都能工作**——有 key 用 Tavily（质量更高），没有 key 用 WebSearch（通用搜索降级）。手动模式只在 UNKNOWN_ENTITY 时触发。

## Risks / Trade-offs

### R1: Tavily API 成本
- **风险**: 每次 /create 虚拟人物需要 4-8 次搜索，Tavily 按次计费
- **缓解**: Tavily 免费 tier 有 1000 次/月，够用。搜索结果可缓存到 soul package

### R2: 搜索结果质量
- **风险**: Tavily 返回的内容可能不够精准，特别是小众角色
- **缓解**: 多次搜索 + LLM 过滤。质量不够时 classification 降级为 UNKNOWN_ENTITY

### R3: LLM 调用次数
- **风险**: Agent 每步都调 LLM 提取 chunks，完整流程可能 8-12 次 LLM 调用
- **缓解**: 用便宜模型（gemini-2.5-flash），每次提取的 chunk 数有限，总成本预计 < $0.01

### R4: 没有 Tavily key 的用户
- **风险**: 用户不想注册 Tavily
- **缓解**: Agent 自动降级到 WebSearch 工具（通用 web 搜索，无需任何 key）。搜索质量略低但足以完成采集。只有 UNKNOWN_ENTITY 才回退手动模式。
