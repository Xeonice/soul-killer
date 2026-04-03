## Context

Soulkiller 当前的 `/evolve` 是一个最小化实现：输入 markdown 路径 → ingest → 全量 re-distill。这在原型阶段可用，但存在三个核心问题：

1. **数据源单一**：只支持 markdown 目录，无法从 URL、对话反馈、直接文本等渠道补充数据
2. **蒸馏效率低**：每次 evolve 都是全量 sample + extract，浪费 token 且无法保留手动调优
3. **不可逆**：soul 文件直接覆盖，没有历史记录，一次糟糕的 evolve 就会破坏整个分身

当前 soul 目录结构：
```
~/.soulkiller/souls/<name>/
├── manifest.json       # 元数据
├── chunks.json         # 所有 SoulChunk
└── soul/
    ├── identity.md     # 身份特征
    ├── style.md        # 沟通风格
    └── behaviors/      # 行为模式
```

## Goals / Non-Goals

**Goals:**
- Evolve 支持 markdown、URL、纯文本、对话反馈四种数据源
- 增量蒸馏：新数据提取 delta 特征，与现有 soul 文件 merge，不破坏已有内容
- 每次 evolve 前自动快照，支持 rollback
- 用户可查看 soul 的数据构成和 evolve 历史
- 用户可选择仅更新 identity / style / behaviors 中的特定维度

**Non-Goals:**
- 不做实时/自动 evolve（如后台持续监听数据源变化）
- 不做对话中的自动学习（feedback 需要用户主动标记）
- 不做 soul 文件的手动编辑器（用户可以直接用编辑器改文件）
- 不做跨 soul 的数据共享或继承

## Decisions

### D1: 多源数据输入采用交互式菜单选择

**选择**：进入 evolve 后展示数据源类型菜单（markdown / url / text / feedback），用户选择后进入对应的输入流程。

**替代方案**：
- 命令行参数 (`/evolve --url https://...`) — 灵活但用户需记忆参数格式，与 REPL 交互风格不一致
- 全自动检测 — 无法区分意图，且不同源需要不同输入

**理由**：与 `/create` 的交互风格一致，用户学习成本低。每种源的输入需求不同（路径/URL/多行文本），菜单选择后切换到对应输入组件更自然。

### D2: 增量蒸馏采用 "提取 delta → LLM merge" 两步策略

**选择**：
1. 仅对新 chunks 运行 extractFeatures（同现有管道），得到 delta features
2. 读取现有 soul 文件内容 + delta features，用 LLM 做智能合并（而非简单拼接）

**替代方案**：
- 全量重蒸馏 — 当前方案，token 浪费大，破坏手动调优
- 纯规则合并（字符串拼接/去重）— 无法处理语义冲突和风格一致性
- 仅追加不合并 — 文件会无限膨胀，且矛盾信息不处理

**理由**：LLM merge 能理解语义，解决冲突（新旧矛盾时优先新数据），保持 soul 文件的连贯性。token 成本可控（只需处理 delta + 现有文件，不需要重新处理全部 chunks）。

### D3: 快照存储在 soul 目录内的 snapshots/ 子目录

**选择**：`~/.soulkiller/souls/<name>/snapshots/<timestamp>/` 下存放 soul/ 目录的完整副本。

**替代方案**：
- Git 版本管理 — 依赖外部工具，对普通用户不友好
- 差异存储（仅存 diff）— 实现复杂，恢复慢，对 markdown 文件收益不大

**理由**：soul 文件通常只有几十 KB，完整副本的存储开销可以忽略。简单的目录复制实现可靠、恢复快速。保留最近 10 个快照，超出自动清理。

### D4: Evolve 历史记录追加到 manifest.json

**选择**：在 manifest 中新增 `evolve_history` 数组，每次 evolve 记录 `{timestamp, sources, chunks_added, snapshot_id, dimensions_updated}`。

**替代方案**：
- 单独的 evolve-log.json — 增加文件数量，需要额外的读写逻辑
- 不记录历史 — 无法实现 audit 功能

**理由**：manifest 已经是 soul 的元数据中心，evolve 历史自然属于这里。保持单一数据源原则。

### D5: 选择性更新通过 dimensions 参数控制

**选择**：evolve 交互流程中增加"更新维度"选择（identity / style / behaviors / all），仅对选中维度运行 delta extraction 和 merge。

**理由**：用户可能只想补充某人的技术文章来丰富 behaviors，而不希望影响已经精心调优的 identity 和 style。维度隔离让 evolve 更可控。

### D6: URL 输入复用 web-adapter 的页面提取能力

**选择**：新增 `url-adapter.ts`，接收 URL 列表，使用现有的 `page-content-extractor`（Readability + Turndown）提取正文，转为 SoulChunk。

**替代方案**：
- 通过 soul-capture-agent 搜索 — 过重，evolve 场景下用户已经知道要补充哪些页面
- 调用外部服务 — 增加依赖

**理由**：复用现有的 `@mozilla/readability` + `turndown` 基础设施，零新依赖。用户提供精确 URL，不需要搜索引擎。

### D7: 对话反馈通过 `/feedback` 命令主动标记

**选择**：在对话模式中新增 `/feedback` 命令。用户在收到分身回复后输入 `/feedback`，系统展示选项（很像本人 / 不太像 / 完全不像），可附加文字说明。反馈存储在 `~/.soulkiller/souls/<name>/feedback.json`，evolve 时通过 feedback-adapter 转为 SoulChunk。

**替代方案**：
- 自动学习（每轮对话后自动评估）— 无法判断用户意图，且噪音大
- 内联标记（在消息中加 👍/👎）— ink 的 TextInput 不支持 emoji 快捷键，实现复杂
- 对话结束后统一打分 — 粒度太粗，无法精确到某条回复

**理由**：主动标记保证数据质量。`/feedback` 与其他 `/` 命令交互风格一致。反馈存储为 JSON 而非直接写入 chunks.json，是因为反馈需要保留原始对话上下文（query + response + rating），转 chunk 时才做内容组织。

### D8: Chunk 时间元信息采用 `temporal` 可选字段 + 置信度分级

**选择**：SoulChunk 新增可选 `temporal` 字段：

```typescript
temporal?: {
  date?: string        // ISO 8601 date (YYYY-MM-DD)，精确到天
  period?: string      // 模糊时间段描述，如 "2010s"、"大学时期"
  confidence: 'exact' | 'inferred' | 'unknown'
}
```

各适配器的时间提取策略：
- **Twitter**：`confidence: 'exact'`（tweet 有精确时间戳）
- **Markdown**：尝试从 frontmatter `date` 字段 → 文件名日期模式（`2024-01-15-title.md`）→ 文件 mtime。frontmatter/文件名匹配到的为 `'exact'`，mtime 为 `'inferred'`
- **Web**：尝试提取 `<meta property="article:published_time">` 或 `<time>` 标签。提取到的为 `'exact'`，否则为 `'unknown'`
- **User-input / Synthetic**：默认 `'unknown'`，用户可在输入时指定时间段

**替代方案**：
- 仅用现有 `timestamp` 字段 — 已被占用为"入库时间"，语义不同
- 强制所有 chunk 都有精确时间 — 很多数据源无法提供

**理由**：`temporal` 与 `timestamp`（入库时间）语义分离。置信度分级让未来 era 切面可以按需过滤：`exact` 的可以精确切分，`inferred` 的可以模糊归类，`unknown` 的归入默认切面。这是为 era 功能做的最小前置投资，不增加当前 evolve 流程的复杂度。

## Risks / Trade-offs

- **[LLM merge 质量不稳定]** → 提供 `--full` 标志允许回退到全量蒸馏；快照机制保底
- **[快照磁盘占用]** → 限制最多 10 个快照 + 自动清理最旧的；soul 文件本身很小
- **[增量 delta 太少时合并效果差]** → 设置最小 chunk 阈值（≥5），低于阈值时提示用户补充更多数据或改用全量模式
- **[URL 提取失败（反爬/付费墙）]** → 错误跳过 + 报告，不阻塞其他 URL；提示用户可以手动复制内容用 text 模式
- **[对话反馈回流数据质量低]** → feedback chunks 标记为 `source: 'feedback'`，在采样时权重降低，避免少量反馈主导蒸馏方向
- **[时间提取准确性参差不齐]** → 通过 confidence 分级显式标记不确定性，不做虚假精确；未来 era 切面可根据 confidence 决定是否纳入
- **[feedback.json 膨胀]** → 每条反馈约 1-2KB，日常使用不太可能超过几百条；如果需要可在 evolve 消费后标记已处理
