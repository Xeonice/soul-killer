## Context

Soulkiller 当前的对话 context 构建在 `app.tsx:buildSystemPrompt()` 中，直接拼接 soul files（identity/style/behaviors）。没有外部世界观注入机制。Soul 是完全自包含的实体，存储在 `~/.soulkiller/souls/<name>/`。

现有基础设施可复用：
- `IngestPipeline`（`src/ingest/pipeline.ts`）：数据源适配 + chunk 生成
- `EngineAdapter`（`src/engine/adapter.ts`）：TF-IDF 相似度召回
- `SoulChunk` 类型体系：已有 source/context/type/temporal 元数据
- 打包/分发流程（`src/soul/package.ts`）

## Goals / Non-Goals

**Goals:**
- World 作为独立实体存储，与 Soul 完全解耦
- 支持 N:M 的 Soul-World 绑定关系
- 三种触发模式（always/keyword/semantic）混合使用
- 从数据源（PDF、小说等）自动蒸馏世界条目，支持交互式审查
- Mustache 风格模板系统用于动态内容
- 多世界叠加时有明确的优先级和冲突解决机制
- World 随 Soul 打包分发，用户可选

**Non-Goals:**
- 不支持 keyword 正则匹配（纯字符串匹配即可）
- 不实现实时协作编辑世界条目
- 不实现世界条目的版本 diff/merge（冲突时由用户选择保留/替换/副本）
- 不支持 World 独立分发（必须随 Soul 分发）
- 不实现条目间的循环引用检测（模板引用链由用户保证无环）

## Decisions

### D1: 存储结构——World 独立目录 + Soul 侧 Binding

```
~/.soulkiller/
├── worlds/
│   └── <world-name>/
│       ├── world.json           # WorldManifest
│       └── entries/
│           └── *.md             # frontmatter + markdown
└── souls/
    └── <soul-name>/
        └── bindings/
            └── <world-name>.json  # WorldBinding
```

**为什么不放在 Soul 内部？** World 需要被多个 Soul 共享。独立存储是唯一支持 N:M 的干净方案。

**为什么 Binding 在 Soul 侧？** 操作流以 Soul 为主体（`/use johnny` → 对话），Soul 需要知道自己绑定了哪些世界。World 不应该知道谁在使用它。

### D2: Entry 格式——Frontmatter Markdown

每个条目是一个 `.md` 文件，使用 YAML frontmatter 描述元数据：

```markdown
---
name: megacorps
keywords: ["荒坂", "军用科技", "Arasaka"]
priority: 100
mode: keyword
scope: lore
---

超企背景内容...
```

**为什么不用 JSON/YAML？** Markdown 对用户友好，可以直接用编辑器阅读和修改。Frontmatter 提供结构化元数据的同时保持内容的可读性。

**Frontmatter 解析方案：** 使用简单的自定义解析器（split on `---`），避免引入 gray-matter 等外部依赖，保持 Soulkiller 的零重依赖原则。

### D3: 触发模式——三级混合

| 模式 | 匹配方式 | 扫描范围 | 适用场景 |
|------|---------|---------|---------|
| `always` | 无条件注入 | — | 核心世界规则 |
| `keyword` | 字符串包含匹配（大小写不敏感） | 用户输入 + 最近 3 轮对话 | 特定概念触发 |
| `semantic` | 复用 engine.recall() 的 TF-IDF | 用户当前输入 | 模糊知识召回 |

**为什么 keyword 不支持正则？** 简化实现和用户心智模型。纯字符串匹配已能覆盖绝大多数场景。

**keyword 扫描最近 3 轮的原因：** 避免只看当前输入导致上下文断裂。例如用户在 3 轮前提到「荒坂」，当前在讨论相关话题但没再提这个词——条目仍应保持激活。

### D4: 多世界优先级——Order × Priority 两级排序

```
effective_priority = (MAX_ORDER - binding.order) * 1000 + entry.priority
```

- `binding.order`：世界级别优先级（0 = 最高），由用户在绑定时设置
- `entry.priority`：条目级别优先级（0-1000），由条目自身定义
- 乘以 1000 保证世界级优先级始终压过条目级
- `priority_boost`（binding 中）可以在不修改世界原始条目的情况下调整特定条目权重

**同名条目冲突：** 多个世界有同名条目时，取 order 最小的世界的版本。

### D5: 模板系统——轻量 Mustache 子集

支持的语法：
- `{{variable}}` — 变量插值
- `{{#if condition}}...{{/if}}` — 条件块
- `{{entries.entry-name}}` — 引用其他条目内容

不支持的语法：
- `{{#each}}` 循环
- `{{> partial}}` 部分模板
- 复杂表达式

**为什么是子集？** 世界条目的模板需求非常简单——主要是插入 soul 名称和引用其他条目。完整的 Handlebars 是 overkill。自实现一个 200 行的解析器比引入 npm 依赖更合适。

模板上下文变量：

```typescript
interface TemplateContext {
  soul: {
    name: string
    display_name: string
    identity: string       // identity.md 全文
    tags: TagSet
  }
  world: {
    name: string
    display_name: string
  }
  entries: Record<string, string>  // 已激活条目的内容
}
```

### D6: World Distill——复用 Ingest + LLM 三阶段提取

```
数据源 → IngestPipeline → chunks
  → Phase 1: LLM 分类 (scope 标签 + irrelevant 过滤)
  → Phase 2: 相似 chunks 聚合为 clusters
  → Phase 3: LLM 每个 cluster → entry.md (含自动 keywords/mode/priority)
  → Phase 4: 交互式审查 (默认开启, --no-review 跳过)
```

**为什么不直接让 LLM 一次生成所有条目？** 数据源可能很大（200 页小说），单次 LLM 调用无法处理。分阶段处理允许流式进度反馈，且每阶段可以独立验证。

**聚合策略：** 使用 TF-IDF 对 chunks 计算相似度矩阵，阈值 > 0.3 的归为同一 cluster。这复用了 LocalEngine 已有的 tokenize + cosineSimilarity。

### D7: Context Assembler——替换原有 buildSystemPrompt

新增 `ContextAssembler` 类统一管理 system prompt 构建：

```
注入顺序：
1. World always entries (按 world.order 排序)
2. Binding persona_context (模板渲染后)
3. Soul identity.md
4. Soul style.md
5. Soul behaviors/*.md
6. World keyword/semantic 命中条目 (按 effective_priority 排序)
7. Soul chunk recall 结果
```

**Token budget 管理：** 每个世界绑定有 `context_budget`（默认 2000 token），总预算由 LLM context window 决定。超预算时从低 effective_priority 条目开始裁剪。使用简单的字符数 ÷ 3 估算 token 数（中文场景足够精确）。

### D8: 分发——World 快照内联到 Soul 包

打包时：
1. 读取 soul 的所有 binding
2. 交互式让用户选择包含哪些世界
3. 选中的世界整个目录复制到包的 `worlds/` 下

安装时：
1. 解包 soul 文件到 `souls/<name>/`
2. 检查 `worlds/` 目录
3. 每个世界：本地不存在则安装；已存在则提示用户选择（保留本地/替换/命名副本）

**为什么内联快照而不是引用？** 接收方可能没有相同的世界。内联保证 soul 包的自包含性。世界有版本号，冲突时用户可以做出明智的选择。

## Risks / Trade-offs

**[Token 预算竞争]** → 多世界 + 大量条目可能快速耗尽 context window。Mitigation：严格的 budget 管理 + 每个世界独立 budget 上限 + 超预算裁剪。

**[Keyword 误触发]** → 常见词作为 keyword 会导致条目频繁无关激活。Mitigation：审查阶段提醒用户避免过于通用的 keyword；运行时可通过 binding 的 `exclude_entries` 过滤。

**[蒸馏质量]** → LLM 从小说提取世界设定的质量不可控。Mitigation：默认开启审查；支持 evolve 增量改进；条目可随时手动编辑。

**[模板循环引用]** → `{{entries.A}}` 引用 B，B 引用 A。Mitigation：Non-goal，不做检测。渲染时设最大递归深度（3 层），超过则原样输出模板标记。文档中说明此限制。

**[Frontmatter 解析]** → 自实现解析器可能有边界 case。Mitigation：只支持简单的 YAML 子集（string、number、string array），复杂结构不支持。充分的单元测试覆盖。
