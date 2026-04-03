# Soulkiller MVP Scope

## 一句话定义

Soulkiller 是一个开源框架，让任何人从自己的数字痕迹中提取"灵魂"，生成可分发的数字分身，其他人可以通过 CLI / Claude / OpenClaw 与之对话。

---

## MVP 目标

用最小可用的方式跑通完整链路：**一个人导入数据 → 生成分身 → 另一个人跟分身对话并能检索到具体记忆**。

不追求完美覆盖所有数据源和消费渠道，先证明这条路走得通。

---

## 用户角色

整个系统有两类用户，需求和操作完全不同。

### 灵魂创建者（Creator）

就是"被克隆的那个人"。他导入自己的数据，生成自己的数字分身，然后决定分发给谁。

**典型画像**：技术从业者、内容创作者、团队 leader、有个人品牌意识的人。共同点是已经有大量数字化的表达（文档、推文、聊天记录），并且有动力把这些表达变成一个可复用的"分身"。

### 灵魂消费者（Consumer）

跟分身对话的人。他不需要知道背后的技术细节，只需要能方便地"连上"某个人的分身。

---

## 交互方式：统一 REPL

所有交互在一个 REPL 里完成，类似 Claude Code 的体验。输入 `soulkiller` 进入，自然语言直接对话，`/` 开头是命令。

### 首次启动 — LLM 配置

```bash
$ soulkiller

  ╔═══════════════════════════════════╗
  ║   🔮 Soulkiller v0.1.0           ║
  ╚═══════════════════════════════════╝

  首次使用，需要配置 LLM。

  Soulkiller 通过 OpenRouter 接入 300+ 模型。
  没有 key？去 https://openrouter.ai/keys 免费创建一个。

  OpenRouter API Key: sk-or-••••••••
  ✓ Key 有效 · 余额 $12.40

  选择默认模型（随时可用 /model 切换）：
  ◉ anthropic/claude-sonnet-4.6     $3/$15 per 1M tokens · 推荐
  ◯ deepseek/deepseek-chat-v3.2    $0.32/$0.89 · 最便宜
  ◯ google/gemini-3.1-pro          $1.25/$5 · 长上下文
  ◯ openrouter/free                免费 · 有限速

  ✓ 配置完成，保存到 ~/.soulkiller/config.yaml

  输入 /create 开始创建你的分身，
  或 /use <name> 加载别人的分身。

>
```

### Creator 流程 — 创建分身

```
> /create

  你叫什么？
  > Douglastang

  一句话介绍自己：
  > 前端工程师，在做 AI + PPT 生成

  你想导入哪些数据源？（空格选择）
  ◉ Markdown 文档目录
  ◉ Twitter Archive

  Markdown 文档在哪？（可以拖文件夹进来）
  > ~/notes ~/docs/tech-articles
  📂 327 个 .md 文件

  Twitter Archive 在哪？
  > ~/Downloads/twitter-archive
  🐦 4,672 条推文

  ⠋ 处理中... ━━━━━━━━━━━━━━━━━━━━ 100%
  ✓ 4,688 chunks indexed
  ✓ 灵魂文件蒸馏完成

  你的分身已就绪。现在可以直接对话了。

> PPT Agent 为什么从 JSON 改成 HTML 直出？

  核心原因有三个。第一，JSON-render 方案的 token
  效率太低...

  [来源: docs/ppt-agent-architecture-v3.md · 2026-02]
```

### Creator 流程 — 增量更新 & 发布

```
> /feed ~/new-articles/

  📂 12 个新文件 → 89 条新记忆
  ✓ identity.md 更新（新增 2 个观点）

> /publish

  发布到哪？
  ◉ GitHub
  ◯ npm

  GitHub repo 名: douglastang/soul
  推送中... ✓

  别人可以这样用：
  soulkiller → /use douglastang
```

### Consumer 流程 — 使用别人的分身

```bash
$ soulkiller

> /use douglastang

  ⠋ 下载 douglastang.soul... (148MB)
  ✓ 加载完成 · 4,777 条记忆 · 中/英/日

  你现在在和 Douglastang 的分身对话。

> 你们 PPT Agent 的架构是怎么演进的？

  最开始是 JSON-render 方案，后来转向了 HTML 直出...

> /source

  本次回答引用了 3 条记忆：
  1. docs/ppt-agent-architecture-v3.md — 2026-02 (相似度 0.91)
  2. tweets/thread-2026-01-15.md — 2026-01 (相似度 0.84)
  3. docs/hydrator-v2-poc.md — 2026-03 (相似度 0.79)
```

### Consumer 流程 — 接入 Claude / OpenClaw

```
> /link

  检测到你的环境：
  ◉ Claude Desktop (已安装)
  ◉ Claude Code (已安装)
  ◯ OpenClaw (未检测到)

  是否自动配置？(Y/n) Y
  ✓ 已写入 Claude Desktop 配置
  ✓ 已写入 Claude Code 配置

  重启 Claude Desktop 后即可使用。

> /export openclaw

  ✓ 导出到 ~/.soulkiller/export/douglastang-openclaw/
  ├── SOUL.md
  ├── MEMORY.md
  ├── skills/soulkiller-recall/
  └── docker-compose.yml

  复制到 OpenClaw workspace 后启动即可。
```

### Slash 命令一览

```
创建 & 数据
  /create              交互式创建分身
  /feed <path>         增量导入新数据
  /distill             手动重新蒸馏
  /rebuild             全量重建向量库

分身管理
  /status              当前分身状态
  /edit identity       直接编辑 identity.md
  /edit style          直接编辑 style.md
  /switch <name>       切换到其他分身
  /list                列出本地所有分身

发布 & 分发
  /publish             发布分身
  /export openclaw     导出 OpenClaw 格式
  /link                自动配置到本地 Claude/OpenClaw

消费
  /use <name>          下载并加载别人的分身
  /source              查看上一次回答的检索来源

LLM
  /model               查看/切换当前模型
  /model <id>          切换到指定模型
  /model suggest       按用途推荐模型

调试
  /recall <query>      手动测试 RAG 检索
  /calibrate           运行校准测试
  /config              查看/修改配置

其他
  /help                帮助
  /compact             压缩对话历史
  /quit                退出
```

---

## 使用场景

### 场景一：技术咨询 — "问问 Douglas 怎么看"

**谁在用**：同事、团队成员
**触发方式**：soulkiller REPL / Claude Desktop / Telegram

你不在的时候，同事遇到技术选型问题，想知道你的看法。

```
同事: 我们现在要选一个工作流引擎，Temporal 和 BullMQ 你倾向哪个？

Douglas(AI): 看场景。如果是 LLM pipeline 这种长时间、有状态
的任务编排，Temporal 更合适，它的 workflow-as-code 模型天然
适合这种有 retry、有 compensation 的流程。但如果只是简单的
任务队列 + 延迟任务，BullMQ 够用了，轻很多。

我之前在做 PPT Agent 的时候评估过这两个，最后选了更轻的方案，
因为我们的场景核心瓶颈不在编排而在 LLM 调用本身。
你们的场景里最复杂的 workflow 长什么样？

[soul_recall 检索到了 2025 年评估工作流引擎的笔记]
```

**价值**：同事不需要等你上线或翻你的文档，分身能基于你的真实经历和偏好给出建议。

### 场景二：代码审查 — "用我的标准 review"

**谁在用**：自己、同事
**触发方式**：Claude Code（通过 /link 配置后）

你想让 Claude 按照你的 review 风格来审查代码。

```
你: @soul-douglastang 帮我 review 这段 hydrator 代码，
    用我平时 review 的标准

Douglas(AI): 看了一下，几个问题：

1. getBoundingClientRect 的调用没有做 batch。你一个元素一个
   元素调会触发 N 次 reflow，这在有 50+ 个 slot 的 slide 上
   会很慢。之前 hydrator-v2 里我专门改过这个——先收集所有元素，
   一次性读取 geometry，再统一写入。

2. CJK 字体宽度补偿的逻辑放在 CSS 层不太对。这个应该在
   hydration 阶段通过 measureText 精确计算，不然中英混排
   的 slide 一定会出问题。

3. 错误处理太粗了，OKLab 颜色解析那块 try-catch 吃掉了
   所有异常，至少要 log 出来看是哪个 color value 挂了。

[soul_recall 检索到了 hydrator-v2 的开发笔记和 7 个 bug 修复记录]
```

**价值**：review 质量一致，不因为你当天忙不忙而波动，而且能引用你过去踩过的具体坑。

### 场景三：新人 Onboarding — "问前辈"

**谁在用**：新入职的团队成员
**触发方式**：soulkiller REPL / Claude Desktop / Telegram

新人加入智文团队，想快速了解 PPT Agent 的技术背景。

```
新人: PPT Agent 为什么从 JSON 渲染方案改成了 HTML 直出？

Douglas(AI): 核心原因有三个：

第一，JSON-render 方案要求 LLM 输出结构化 JSON，这个 token
效率很低。一个中等复杂度的 slide，JSON 描述可能要 2000 token，
但用 HTML + Tailwind 表达同样的内容只需要 500 token 左右。

第二，CSS 的表达能力被 DSL 限制死了。我们自己定义的 JSON DSL
永远在追赶 CSS 的能力，渐变、动画、复杂布局每次都要加新字段。
直接用 HTML/CSS 就不存在这个问题。

第三，Puppeteer 这条路实际上是可行的。我做了 hydrator-v2 的
POC，用 getBoundingClientRect 拿到精确几何信息后，再 hydrate
到 OpenXML 层。7 个渲染 bug 都已经解决了。

你可以看看我写的架构演进文档，在飞书的 PPT Agent 目录下。

[soul_recall 检索到了架构演进的 3 篇文档 + POC 验证记录]
```

**价值**：新人不需要翻遍所有文档或反复打扰忙碌的同事，分身就是一个 24/7 在线的"导师"。

### 场景四：风格代笔 — "帮我写，用我的调性"

**谁在用**：自己
**触发方式**：soulkiller REPL / Claude Code

你需要写一篇内部分享文章或邮件，但想保持自己的写作风格。

```
你: 帮我写一篇内部分享文章，主题是 Claude Code 的 Hooks
    功能，用我平时写技术分享的风格

Douglas(AI): # Claude Code Hooks：让 AI 在你的工作流里扎根

大家有没有遇到过这种情况：Claude Code 生成了代码，你 commit
了，然后 CI 挂了——lint 没过、test 没跑、commit message
格式不对。每次都要手动补，很烦。

Hooks 就是解决这个问题的。它的核心思路很简单：在 Claude 的
关键动作节点（保存文件、执行命令、结束任务）插入你自定义的
脚本。本质上就是 Git hooks 的思路搬到了 AI 工作流里...

[soul_identity 加载了 style.md 中的写作风格特征]
```

**价值**：保持个人品牌的一致性，节省从零起草的时间。

### 场景五：异步决策 — "我不在的时候先问分身"

**谁在用**：团队成员
**触发方式**：OpenClaw (Telegram group)

你在休假或不同时区，团队需要快速做一个技术决策。

```
[Telegram 团队群]
同事A: @douglas-bot 我们要不要把 PPT 解析服务从 NestJS
       迁移到 Go？性能瓶颈在 XML 解析上

Douglas(AI): 我的建议是不迁。原因：

1. 性能瓶颈大概率不在 NestJS 本身，而在 OOXML 的结构复杂度。
   换 Go 写 XML 解析该复杂还是复杂，而且 Go 的 XML 库在处理
   namespace 的时候比 Node 的还难用。

2. 我们团队没有 Go 经验，学习成本 >> 性能收益。

3. 如果真要优化，我建议先看看是不是 font 继承链的递归查找
   拖慢了整体。我之前测过，主 slide + layout + master 三层
   继承解析占了总耗时的 40%，这个可以加缓存解决。

不过这是我的判断，你们最好等我回来后拉个会对齐一下。分身的
建议仅供参考，最终决策还是人来拍。

[soul_recall 检索到了 PPTX 解析性能优化的历史记录]
```

**价值**：团队不被时区/假期阻塞，但分身会明确标注这是 AI 建议而非本人决策。

### 场景六：个人品牌 — "让别人认识我"

**谁在用**：外部开发者、社区成员
**触发方式**：soulkiller REPL / Web（Phase 2）

你在开源社区或技术社区有一定影响力，别人想了解你的技术观点。

```
社区成员: 你觉得 low-code 平台的未来方向是什么？
         你之前在蚂蚁做过云凤蝶是吧？

Douglas(AI): 对，我在蚂蚁做了两年多的云凤蝶，主要负责
ViewModel 架构、表单联动和打印功能。

我的看法是，传统 low-code 平台的问题在于它试图用可视化编辑器
替代代码，但这条路的天花板很明显——稍微复杂一点的逻辑就必须
escape 到代码层。

现在 AI 改变了这个局面。与其让用户拖拽组件，不如让 AI 直接
生成代码。我们在智文做的 PPT Agent 其实就是这个思路——用户
描述意图，AI 生成完整的 slide，不需要用户懂任何 DSL。

所以我觉得 low-code 的未来不是"更好的拖拽"，而是"更智能
的生成"。平台的价值从"提供拖拽界面"变成"提供约束和规范"。

[soul_recall 检索到了云凤蝶相关经历 + PPT Agent 设计理念]
```

**价值**：个人品牌 24/7 在线，能回答关于你的背景和观点的问题。

---

## 关键交互设计原则

**1. 分身必须自我标识**：分身的每次回答都应该让对方清楚这是 AI 而非本人。不需要每句话都加 disclaimer，但在首次对话和做重要决策建议时必须明确。

**2. 分身知道自己的边界**：对于没有数据支撑的问题，分身应该说"我不确定，这块我的记忆里没有相关信息"，而不是编造。宁可少说，不能瞎说。

**3. 检索结果要有溯源**：分身引用具体记忆时，应该能标注数据来源（"这是我在 2025 年 11 月写的技术文档里提到的"），让消费者自行判断可信度。

**4. 风格因受众而变**：分身跟同事聊技术应该直接、精确；跟陌生人聊应该更耐心、有上下文铺垫。这是 style.md 里定义的沟通模式，蒸馏时就要区分。

**5. 敏感话题有底线**：分身不代替本人做出承诺、签署协议、发表可能有法律/政治风险的观点。遇到此类场景应明确拒绝并建议联系本人。

---

## 架构总览

```
┌──────────────────────────────────────────────────────────┐
│                    Creator Side                          │
│                                                          │
│  soulkiller REPL                                         │
│  ├─ /create      交互式创建分身                           │
│  ├─ /feed        增量导入数据                             │
│  ├─ /distill     蒸馏灵魂文件                            │
│  ├─ /publish     发布                                    │
│  └─ 自然语言      直接跟分身对话测试                       │
│                                                          │
│  soulkiller-engine (Docker)                              │
│  ├─ Ingest Pipeline    清洗 + 分块 + embedding           │
│  ├─ Vector Store       LanceDB（本地，单文件）            │
│  ├─ Soul Distiller     从向量库蒸馏 identity/style/behavior│
│  └─ HTTP API (:6600)   recall / ingest / soul            │
│                                                          │
│  LLM 通道：OpenRouter                                    │
│  ├─ 蒸馏用高质量模型（Claude Sonnet / GPT-5）             │
│  ├─ 对话用性价比模型（DeepSeek / Gemini Flash）           │
│  └─ /model 命令随时切换                                   │
└──────────────┬───────────────────────────────────────────┘
               │ soul package
    ┌──────────┼──────────┐
    ▼          ▼          ▼
 REPL 直聊  MCP Server  OpenClaw
 (零配置)   (Claude)    (Telegram等)
```

---

## Phase 1：数据采集（2 个数据源）

MVP 只做两个**最干净、最容易获取**的数据源，先跑通 pipeline：

### P1-1: Markdown 文档

- 扫描指定目录下所有 `.md` 文件
- 按 heading 分块（h1/h2 级别切分）
- 提取元数据：文件名、修改时间、目录路径（作为 topic 标签）
- 输出统一格式的 chunks

**为什么先做这个**：零依赖，无需解密或 API，你的技术文档和笔记就是最高质量的"灵魂原料"。

### P1-2: Twitter Archive

- 从 Twitter 官方导出的 `data/tweets.js` 解析
- 过滤 RT、纯链接推文
- 按时间排序，相邻推文（<30min）合并为 thread
- 提取：推文内容、时间、是否为回复

**为什么做这个**：Twitter 是观点密度最高的数据源，每条推文都是压缩过的想法。

### 不在 MVP 的数据源

- 微信聊天记录（导出工具链不稳定，MVP 不冒险）
- 飞书（需要企业 API 审批，流程太长）
- Claude 会话历史（等 Anthropic 开放导出 API）

这三个放 Phase 2，但 ingest pipeline 的 adapter 接口现在就设计好，后续插入新 adapter 不需要改核心逻辑。

### 统一 chunk 格式

```typescript
interface SoulChunk {
  id: string;                    // 唯一 ID
  source: "markdown" | "twitter" | "wechat" | "feishu" | "claude";
  content: string;               // 正文
  timestamp: string;             // ISO 8601
  context: "public" | "work" | "personal";
  type: "opinion" | "decision" | "reflection" | "knowledge" | "casual";
  metadata: Record<string, any>; // 源特定的元数据
}
```

---

## Phase 2：蒸馏引擎

把向量库里的 raw chunks 蒸馏成结构化的灵魂文件。

### 蒸馏流程

```
Vector Store (全量 chunks)
       │
       ▼
  采样 + 聚类（按 topic 聚类，每个 cluster 采样代表性 chunks）
       │
       ▼
  LLM 提取（通过 OpenRouter 调用，从采样中提取特征）
       │
       ▼
  生成结构化灵魂文件
       │
       ├─→ identity.md    "这个人是谁，相信什么"
       ├─→ style.md       "这个人怎么说话"
       └─→ behaviors/     "这个人在特定场景下怎么做"
```

### identity.md 的结构

```markdown
# Identity

## 基本信息
前端工程师，6+ 年经验，现在在做 AI + PPT 生成方向。

## 世界观 & 价值判断
- 技术选型：偏好简单性胜过灵活性，先 POC 验证再推方案
- 工程哲学：HTML/CSS 是被低估的 DSL，能用声明式就不用命令式
- AI 观点：LLM 的输出格式选择很关键，token 效率直接影响质量
- ...（从数据中提取）

## 矛盾与复杂性
- 追求极简架构，但在 OOXML 这种无法简化的领域也能接受复杂性
- ...（刻意保留矛盾，这才是真人）
```

### style.md 的结构

```markdown
# Style

## 语言习惯
- 主要中文沟通，技术术语保留英文原词
- 经常中英混用：「这个 approach 的 tradeoff 是...」
- 偏好直接表达，不绕弯

## 沟通模式
- 跟同事：直接、技术化、偏好用实际代码/示例说明问题
- 公开分享：有教学倾向，喜欢拆解复杂问题
- 日常闲聊：偶尔用日语，聊投资、动画、音乐

## 口头禅 / 高频表达
- （从数据中统计提取）
```

### MVP 蒸馏方案

MVP 阶段通过 OpenRouter 调用 LLM 做蒸馏，不搞自动聚类。流程：

1. 从向量库随机采样 200 条 chunks
2. 按 source 和 type 分组
3. 分批发给 LLM（使用 config 中的 distill_model），prompt 要求提取 identity/style/behavior 特征
4. 将多批结果合并去重，生成最终 markdown

蒸馏推荐用高质量模型（如 `anthropic/claude-sonnet-4.6`），日常对话可以切到便宜模型。用户可以通过 `/model` 随时切换。

后续优化：加入 embedding 聚类做更智能的采样，加入 drift detection 做增量蒸馏。

---

## Phase 3：Soul Package

蒸馏完成后，打包成可分发的 soul package。

### 包结构

```
douglastang.soul/
├── manifest.json
│   {
│     "name": "douglastang",
│     "display_name": "Douglastang (Tang Hehui)",
│     "version": "0.1.0",
│     "created_at": "2026-04-01",
│     "languages": ["zh", "en", "ja"],
│     "description": "前端工程师，PPT Agent 架构师",
│     "chunk_count": 12847,
│     "embedding_model": "bge-m3",
│     "engine_version": "0.1.0"
│   }
├── soul/
│   ├── identity.md
│   ├── style.md
│   └── behaviors/
│       ├── code-review.md
│       ├── architecture-design.md
│       └── casual-chat.md
├── vectors/
│   ├── index.lance/          # 预计算的 LanceDB 索引
│   └── config.json           # embedding 模型信息
├── examples/
│   ├── good.jsonl            # 校准用的正样本
│   └── bad.jsonl             # 校准用的负样本
└── SOUL.md                   # OpenClaw 兼容格式（从 identity.md 生成）
```

### Embedding 模型选择

MVP 用 **BGE-M3**（BAAI/bge-m3）：

- 多语言支持（中英日都覆盖）
- 模型不大（~570MB），Docker 里打包得起
- 在中文 benchmark 上表现好
- 支持 dense + sparse 混合检索

---

## Phase 4：消费端

三种消费方式，按优先级排列。

### 方式一：REPL 直聊（MVP 核心，零配置）

消费者输入 `soulkiller`，`/use <name>` 下载分身，直接在终端对话。这是最轻量的消费方式，只需要 Node.js 和一个 OpenRouter Key。

REPL 进程内直接加载 LanceDB（用 `@lancedb/lancedb` npm 包读取预计算的向量索引），embedding 查询用 `@xenova/transformers` 跑本地模型。对话通过 OpenRouter 调 LLM。不需要 Docker。

### 方式二：MCP Server（Claude 生态）

通过 `/link` 命令自动配置，让 Claude Desktop / Claude Code 接入分身。

```json
{
  "mcpServers": {
    "soul-douglastang": {
      "command": "npx",
      "args": ["soulkiller-mcp", "douglastang"]
    }
  }
}
```

MCP Server 暴露两个 tool：

```typescript
// Tool 1: soul_recall — 语义检索相关记忆
{
  name: "soul_recall",
  input: {
    query: string,
    limit?: number,
    source?: string,
    time_range?: string,
  },
  output: SoulChunk[]
}

// Tool 2: soul_identity — 获取常驻人格信息
{
  name: "soul_identity",
  input: {
    section?: "identity" | "style" | "behavior",
  },
  output: string
}
```

消费端 MCP Server 不需要 Docker，直接 Node.js 进程内加载向量索引。

### 方式三：OpenClaw 集成

通过 `/export openclaw` 导出 OpenClaw 兼容格式：

```
douglastang-openclaw/
├── SOUL.md          # 从 identity.md + style.md 合并生成
├── MEMORY.md        # 从 behaviors/ 生成长期记忆摘要
├── skills/
│   └── soulkiller-recall/
│       ├── SKILL.md
│       └── scripts/
│           └── recall.sh   # curl localhost:6600/recall
└── docker-compose.yml      # RAG engine
```

OpenClaw 场景下如果要 RAG 需要 Docker（因为 Skill 脚本没法内嵌 LanceDB runtime）。不启动 Docker 就只有静态人格，也能用。

---

## LLM 方案：OpenRouter

所有 LLM 调用统一走 OpenRouter，一个 Key 接入所有模型。

### 为什么选 OpenRouter

- 一个 API Key 接 300+ 模型、60+ 提供商
- API 完全兼容 OpenAI SDK，切换模型只需改 model ID
- 不加价，按原价透传 provider 定价（平台收 5.5% 充值手续费）
- 有免费模型可以零成本体验
- 用户自由选择：想用 Claude 就 Claude，想省钱用 DeepSeek 也行

### 配置结构

```yaml
# ~/.soulkiller/config.yaml
llm:
  provider: openrouter                          # MVP 只支持 openrouter
  api_key: sk-or-xxx                            # 或 env: OPENROUTER_API_KEY
  default_model: anthropic/claude-sonnet-4.6    # 日常对话
  distill_model: anthropic/claude-sonnet-4.6    # 蒸馏（可选，默认同 default）

# 预留扩展
# llm:
#   provider: ollama
#   base_url: http://localhost:11434
#   model: llama3
```

### 推荐模型组合

| 用途 | 推荐模型 | 价格 | 理由 |
|------|----------|------|------|
| 蒸馏 | anthropic/claude-sonnet-4.6 | $3/$15 per 1M | 中文理解强，蒸馏质量高 |
| 日常对话 | deepseek/deepseek-chat-v3.2 | $0.32/$0.89 per 1M | 性价比极高，中文好 |
| 免费体验 | openrouter/free | 免费 | 有限速，适合试用 |
| 长上下文 | google/gemini-3.1-pro | $1.25/$5 per 1M | 1M context window |

用户通过 `/model` 命令随时切换，不同场景用不同模型。

---

## 不在 MVP 的东西

| 功能 | 原因 | 计划 |
|------|------|------|
| 微信 / 飞书 / Claude 数据源 | 导出工具链不稳定或需 API 审批 | Phase 2 |
| Web 聊天界面 | 需要后端算力，涉及成本 | Phase 3 |
| ClawHub 发布 | 等 MVP 验证后再上 registry | Phase 2 |
| 增量蒸馏 / drift detection | 需要先有基线数据验证 | Phase 2 |
| 多人格切换 | 先搞定单人格 | Phase 3 |
| 隐私分级 / access control | 重要但 MVP 先在信任圈内测试 | Phase 2 |
| 语音克隆 / 视觉形象 | 超出 text-based 分身的范畴 | 远期 |
| 校准测试自动化 | MVP 手动校准就行 | Phase 2 |
| Ollama / 本地模型支持 | 先用 OpenRouter 跑通，后续扩展 provider | Phase 2 |
| 直连 Anthropic / OpenAI API | OpenRouter 已覆盖，无需单独接入 | 按需 |

---

## 技术栈

| 层 | 选型 | 理由 |
|----|------|------|
| CLI / REPL | Node.js + TypeScript | 跟 MCP/Skill 生态一致，Claude Code 同款体验 |
| REPL 框架 | ink (React for CLI) 或自研 | 支持交互式 UI + 流式输出 |
| Docker Engine | Python + FastAPI | 数据处理生态更成熟（pandas, langchain） |
| Embedding | BGE-M3 (BAAI/bge-m3) | 中英日多语言，性能平衡 |
| 向量库 | LanceDB | 嵌入式，单文件，适合打包分发 |
| LLM 通道 | OpenRouter API | 一个 Key 接所有模型，OpenAI SDK 兼容 |
| MCP Server | Node.js + @modelcontextprotocol/sdk | 官方 SDK，Claude 原生支持 |
| OpenClaw 集成 | SKILL.md + shell scripts | 遵循 AgentSkills 规范 |

---

## 里程碑

### M1: 数据进得去（1 周）

- [ ] REPL 骨架：启动界面、slash 命令解析、OpenRouter 配置流程
- [ ] `/create` 交互式引导：名字、简介、数据源选择
- [ ] Markdown adapter：扫描 + 分块 + 统一格式
- [ ] Twitter adapter：解析 archive + 过滤 + 合并 thread
- [ ] Docker engine：ingest API + LanceDB 写入 + BGE-M3 embedding
- **验收**：在 REPL 中完成 `/create`，导入 100 篇 markdown + 1 份 twitter archive，能用 `/recall` 测试语义检索

### M2: 灵魂蒸得出（1 周）

- [ ] 蒸馏 pipeline：采样 → OpenRouter 调 LLM 提取 → 生成 identity.md / style.md / behaviors/
- [ ] `/model` 命令：查看、切换模型
- [ ] `/distill` 命令：手动触发蒸馏
- [ ] soul package 打包
- [ ] manifest.json 生成
- **验收**：读生成的 identity.md，能认出这是谁。`/model` 切换模型后蒸馏正常工作

### M3: 分身聊得了（1 周）

- [ ] REPL 内直接对话：加载 soul + RAG，通过 OpenRouter 调 LLM 生成回答
- [ ] `/source` 命令：展示检索来源
- [ ] `/use <name>` 命令：下载远程 soul package 并加载
- [ ] `/publish` 命令：打包并推送到 GitHub
- [ ] MCP Server：soul_recall + soul_identity 两个 tool
- [ ] `/link` 命令：自动配置到 Claude Desktop / Claude Code
- **验收**：在 REPL 中跟分身对话，能检索到具体记忆；通过 `/use` 加载别人的分身；Claude Desktop 通过 MCP 接入分身

### M4: OpenClaw 接得上（1 周）

- [ ] `/export openclaw` 命令
- [ ] OpenClaw SOUL.md / MEMORY.md 生成
- [ ] recall skill + docker-compose for RAG engine
- **验收**：通过 Telegram 给 OpenClaw agent 发消息，对面是分身在回复

### M5: 校准跑得通（3 天）

- [ ] `/calibrate` 命令：准备 20 个场景问题，对比分身输出
- [ ] Prediction Score 计算：holdout set 对比
- [ ] 根据校准结果手动调整蒸馏 prompt
- **验收**：Prediction Score 的 cosine similarity 中位数 > 0.7

---

## 开发顺序建议

```
Week 1: M1（REPL 骨架 + 数据采集）
         → 先搭 REPL 框架和 OpenRouter 接入
         → 再做数据 adapter 和 Docker engine
         → 周末能在 REPL 里 /create + /recall

Week 2: M2（蒸馏）
         → 需要 M1 的数据做输入
         → 这周末能在 REPL 里读到生成的灵魂文件

Week 3: M3（REPL 对话 + MCP + 发布）
         → 核心体验：REPL 里跟分身聊天
         → 同时做 MCP Server 和 /publish /use
         → 这周末完整链路跑通

Week 4: M4 + M5（OpenClaw + 校准）
         → M4 和 M3 大部分复用
         → M5 贯穿始终但集中在最后收尾
```

**总计约 4 周，一个人 full-time 或两个人 part-time 可完成 MVP。**
