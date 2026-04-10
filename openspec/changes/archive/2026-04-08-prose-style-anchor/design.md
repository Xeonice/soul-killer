## Context

soulkiller export 出来的 **所有** visual novel skill 在 Phase 2 运行时都会产生"翻译腔中文" —— 句法结构、比喻选词、所有格排比都是源语言（英/日）的字面投影。fsn 间桐桜是最容易观察到的例子（源数据语言异质 + 角色复杂），但这不是 IP 特异问题：诸葛亮三国、阿尔托莉雅独立 skill 等在中文输出时都有同类症状，只是程度更轻。本质是 **整条 export → runtime 管线缺少一个"中文写作质量"决策点**。

诊断后定位到三个普适根因（不限于任何 IP）：

1. **distill 阶段无目标语言决策**：`src/distill/distill-agent.ts:210` 写明 "Write in the same language as the majority of source data"。任何源数据混杂的角色（不限于 fsn）都会得到一份语言异质的 style.md；即使源数据是中文，wiki 风格中文本身就带微弱翻译腔。
2. **SKILL.md 模板无任何中文写作质量约束**：`skill-template.ts` 里 grep 不到任何"中文/翻译腔/native"相关条款，Phase 2 prompt 只有一句"使用沉浸式第二人称描写"。这是一个 **全局空白**，影响所有 export。
3. **style.md 是元描述而非声音锚点**：所有 distill 出来的 style.md 都长得像 wiki 词条（"她说话方式带有...傲娇..."），不提供任何可模仿的中文叙事样本，LLM 拿到只能 fallback 到自己的默认中文分布——而 LLM 的默认中文分布带强烈翻译腔倾向。

目标：**所有未来 export 出的 skill 都必须经过 prose style 决策环节**，让翻译腔在结构层面被压制，而不是依赖 LLM 自觉。

经过 explore 阶段的讨论，确定走"分层决策"方案：distill 不动，决策权完全推到 export 阶段；export agent 拿到全图（world + characters）后，由 LLM 自己根据上下文决定一份故事级 prose_style，并把通用翻译腔反例库 inline 到决策工具的 description 里，让 LLM 带着具体症状学知识做决策。set_prose_style 是 **所有 export 的强制步骤**，不是可选优化。

## Goals / Non-Goals

**Goals:**

- 在 export 阶段引入一个**单点决策**：本故事的 prose style 是什么样
- 提供一个**通用中文翻译腔反例库**作为决策上下文，让 LLM 不靠抽象审美而是带着具体反模式做决策
- 把决策结果以**结构化字段**（forbidden_patterns / ip_specific）写进 story-spec.md，让下游 Phase 1/2 拿到的是硬约束而不是软建议
- 处理 fsn 这类源语言异质 IP：当角色 style.md 含大量非目标语言时，让 export agent 在工具调用中提供中文摘要锚点
- 保持向后兼容：旧 export 不带 prose_style 时，模板使用通用 fallback（而不是直接报错）

**Non-Goals:**

- **不**修改 distill 流程或重新 distill 现存 souls。distill 上游的语言决策代价过高（所有现存 skill 都要重 distill），且 distill 在 export 之前发生，没有"目标语言"的全局上下文。
- **不**做运行时自检改写（让 Phase 2 输出后再让 LLM 自己审视并改写）。这会让每个场景的 token 消耗 + 延迟翻倍，UX 不可接受。
- **不**为多语言 target 做完整支持。第一版只针对 zh 目标，target_language 字段保留扩展位但 forbidden_patterns 库只有中文翻译腔。
- **不**自动 fix 已经 export 的 skill。新 prose_style 字段是新 export 的事，已 archive 的 skill 需要 user 手动重新 export 才能享受。
- **不**做 prose_style 的 lint 校验（验证 Phase 1 LLM 写出的 prose 是否真的符合 prose_style）。这是一个开放问题，留给后续 change。

## Decisions

### Decision 1: 决策点放在 export agent 工具调用层，而不是模板硬编码

**选项对比**：
- (a) 把 prose_style 决策固化到 SKILL.md 模板里 —— 所有 export 用同一份反例库 + 通用引导
- (b) export agent 在工具调用层决策 —— 每次 export 由 LLM 根据上下文决定

**选 (b)**。理由：

- fsn 的"宝具/Servant 不译"和三国的"在下/将军" 是不同 IP 的特异需求，模板硬编码无法覆盖
- export agent 此刻已经读完 world manifest 和所有 character data，**有最完整的上下文做决策**
- LLM 现编 ip_specific 部分比维护一份"所有可能 IP 的特异规则表"灵活得多

### Decision 2: 通用反例库放代码不放数据

**选项对比**：
- (a) 反例库存为 yaml/json 数据文件，运行时加载
- (b) 反例库写成 TypeScript 模块，编译期类型检查

**选 (b)**：`src/export/prose-style/zh-translatese-patterns.ts`。理由：

- 反例库结构稳定（每条 = id + bad + good + reason），TypeScript interface 比 yaml schema 更稳
- 编译期类型检查能防止反例条目格式错误
- 测试 import 同一份模块，避免数据文件读取的额外 IO
- 反例库本质是"代码资产"而不是"用户数据"，归类到 src/ 比 data/ 更合适

### Decision 3: prose_style 字段结构 —— 混合（元数据 + 自由文本 + 结构化反例 + IP 特异）

```typescript
interface ProseStyle {
  target_language: 'zh'                          // 第一版只支持 zh
  voice_anchor: string                           // 自由文本 — 抽象方向，例如 "type-moon 系日翻中视觉小说"
  forbidden_patterns: ProseStyleForbiddenPattern[]  // 通用反例库的子集 + export agent 选出的相关条目
  ip_specific: string[]                          // export agent 现编的故事特异规则，bullet 列表
  character_voice_summary?: Record<string, string> // 角色名 → 中文声音摘要（仅当 source style.md 非中文时填写）
}

interface ProseStyleForbiddenPattern {
  id: string         // e.g. 'degree_clause'
  bad: string        // 反例
  good: string       // 正例
  reason: string     // 为什么 bad
}
```

理由：

- `voice_anchor` 给抽象方向（一句话定调），LLM 看一眼就能进入正确语境
- `forbidden_patterns` 给硬红线（结构化反例对照），LLM 比对具体模式比理解抽象规则更可靠
- `ip_specific` 给故事特异规则（自由文本 bullet），承接抽象决策无法覆盖的边角
- `character_voice_summary` 是 fsn 这种异质 IP 的兜底，只在需要时填

### Decision 4: 反例库 inline 到工具 description（不是外部文件 read）

**选项对比**：
- (a) export agent 用 read_prose_style_guide 工具读外部文件
- (b) 反例库直接 stringify 进 set_prose_style 工具的 description 字段

**选 (b)**。理由：

- 反例库是 export agent 必读上下文，不是可选信息，没必要绕一次 tool call
- 描述长度估算 ~500 tokens，只在 export 阶段付一次，可接受
- 减少 LLM 的"决定要不要读"的负担，避免它跳过反例库直接拍脑袋

### Decision 5: set_prose_style 在工作流中的位置

放在 `set_story_state` 之后、`add_character` 之前：

```
1. set_story_metadata
2. set_story_state
3. set_prose_style  ★ 新增
4. add_character (× n)
5. set_character_axes (× n)
6. finalize_export
```

理由：

- metadata 和 state 已经定 → 知道是什么类型的故事 → 有上下文做风格决策
- 还没开始具体角色 → 不会被某个角色的细节带偏（避免 LLM 看到 Saber 就以为整个故事都是 Saber 风格）
- character_voice_summary 是 set_character_axes 之后才能填的（要先看到 style.md 内容），但放在主决策之后没问题；也可以让 export agent 在 add_character 时一次性提供 voice_summary。最终方案：set_prose_style 时只填 voice_anchor + forbidden_patterns + ip_specific，character_voice_summary 在 add_character 阶段用一个 optional 参数补

### Decision 6: 新 export 强制要求 prose_style；fallback 只为旧归档服务

- `ExportBuilder.build()` SHALL 在 `proseStyle` 缺失时 **throw error**（不再是 warning）
  - 这会让 finalize_export tool 返回 `{ error: "prose_style is required — call set_prose_style before finalize_export" }`
  - agent 看到错误后会补调 set_prose_style，符合 tool loop 的自修正模式
- 同时为了向后兼容旧归档（在本 change 前已经 export 出去的 skill，其 story-spec.md 没有 prose_style 章节），skill-template.ts 在渲染时**仍然**需要 fallback 分支：
  - 有 `prose_style` → 渲染完整章节
  - 无 `prose_style` → 渲染 fallback（通用反例库的 5 条最高频条目 + 通用中文写作指引）
- 理由：新 export 一律强制 prose_style，**杜绝任何翻译腔**是硬目标；fallback 分支只为已经 archive 的旧 skill 服务，让它们在 player 端加载时不会完全裸奔

### Decision 7: distill 不动是硬决定

**选项对比**：
- (a) distill 加 target_language 参数，强制翻译/统一语言
- (b) export 阶段做摘要翻译
- (c) distill 完全不动，runtime 让 LLM 自己处理

**选 (b) 的减弱版**：distill 不动，**export agent 在 add_character 时检测每个角色 style.md 的语言占比**；若非目标语言占比 > 阈值（initial 30%），让 LLM 在工具 input 中提供该角色的 character_voice_summary。

理由：

- distill 改造代价过大（所有现存 souls 重 distill）
- runtime 翻译不可靠（LLM 经常忘 / 半翻译）
- export 阶段做一次中文摘要是性价比最高的选择：**一次性 token 开销，永久写进 story-spec**

## Risks / Trade-offs

| Risk | Mitigation |
|---|---|
| LLM 在 set_prose_style 时仍然产出抽象描述（"应该克制、应该有日系感"），下游无法落地 | tool description 强制要求 ip_specific 至少 3 条具体规则；forbidden_patterns 必须从通用库选 ≥ 3 条；voice_anchor 必须含具体 IP 类型词（"type-moon"/"古典章回"/"赛博朋克"等） |
| 通用反例库覆盖不全，新出现的翻译腔模式无法捕获 | 反例库设计为"易扩展"：单文件、TypeScript array、加新条目只需追加；后续可以从用户反馈循环补 |
| Phase 2 LLM 看到 forbidden_patterns 但仍违反（软约束失效） | Phase 2 prompt 把 forbidden_patterns 渲染成清单形式，每条前加 "**必须避免**" 字样；不依赖单点提醒，而是结构化重复 |
| character_voice_summary 是 LLM 摘要的中文，本身可能也带翻译腔 | tool description 明确要求 voice_summary 用"克制书面中文"+不超过 200 字，并且要求复述 1-2 句该角色的标志性台词作为锚点 |
| 旧 skill 用通用 fallback 时效果不如新 skill | 接受这个差异。fallback 至少有通用反例约束，比当前完全裸奔强；用户想要更好效果就重新 export |
| inline 500 tokens 的反例库到 tool description 增加 export agent context | 可接受。export agent 总 context 已经几千 tokens，500 tokens 的固定开销换 prose 质量值得 |
| set_prose_style 成为 export 工作流的硬依赖，LLM 偶尔可能跳步 | build() 检测缺失 → throw → finalize_export 返回 error → agent 在下一轮自修正补调 set_prose_style。System prompt 改 6 步并明确 "set_prose_style 是必经环节" |

## Open Questions

- character_voice_summary 的检测阈值（非目标语言占比）应该是 30% 还是更严格？需要在实现时跑几个 fsn 角色看看实际占比分布
- forbidden_patterns 是 export agent 从通用库选子集，还是直接全量复制通用库？前者更克制但可能漏掉关键条目，后者更稳但 story-spec.md 会膨胀
- ip_specific 的 bullet 是否需要再加结构化 schema（比如 "term_preservation" / "register" / "metaphor_pool"），还是保持自由 string list？倾向自由 list，避免过度工程
- 是否需要 lint：检查 SKILL.md 模板渲染出的 prose_style 章节符合 Anthropic Skill spec？目前看不需要，prose_style 不影响 yaml 结构
