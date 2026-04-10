## Context

soulkiller 导出的 skill 在 Phase 1 运行时产生"资料被略读"的症状：生成的剧本感觉信息单薄、深层 behaviors 细节从不出现、prose-style-anchor change 刚加的 prose_style 约束看起来像没被遵守。

用户用 `three-kingdom-chibi-in-skill-0003tvip`（9 角色 skill）在 Claude Code 里重跑 Phase -1 → Phase 0，直接从 Read 日志看到证据：

```
Read script-hr5act01.yaml  → lines 1-15   (Phase -1 拿 frontmatter)
Read story-spec.md          → lines 1-50   (Phase 0 拿 acts_options)
```

**LLM 默认用 `offset/limit` 参数做分页读取**。Claude Code 的 Read 工具本身支持分页，LLM 被训练成"先读头部探情况"。SKILL.md 从没明确对抗这个默认行为。

关键技术约束：

- 用户使用 Claude Opus 4.6 **1M context** 模型
- 9 角色 skill 的总 md 文本 ≈ 100K tokens（远坂凛单角色 skill 已经是 ~230KB 文本 / ~60K tokens，9 角色 × 行为文件 × world ≈ 400KB / 100K tokens）
- 这意味着 **context 预算根本不是问题**（10% 利用率），LLM 的节俭是习惯而不是必要
- Phase 0 和 Phase 1 共享同一个 Claude 会话，Phase 0 的部分读取会**污染** Phase 1 的上下文：LLM 看到"story-spec.md 已读"就不会再 Read，而 prose_style 章节 / Story State 章节都在 story-spec.md 的 line 80+ 之后，从来没进过 Phase 1 的视线

这是为什么 prose-style-anchor change 明明加了强制 prose_style 段，实际生成的剧本里还是有翻译腔 —— LLM 根本没看到那个段。

## Goals / Non-Goals

**Goals:**

- Phase 1 的"读数据"阶段从软指令升级为**可验证的硬约束**
- 彻底消除 `offset/limit` 分页读取的默认行为
- 修复 Phase 0 → Phase 1 的上下文污染
- 给 LLM 一个**显式的上下文预算授权**，让它知道"这次要大读，不要节俭"
- 加一层 meta-output 自检（Step 0 数据加载报告 + Step 5.h 数据覆盖自检），让 skip 在输出格式层面就暴露
- 最小改动：只修改 SKILL.md 模板和 packager 的 file-count 估算，不动 export agent 或 distill 流程

**Non-Goals:**

- **不**做分批读取策略（L3/L5）。1M context 下没必要，过度工程。
- **不**修改 distill 流程。这个问题完全是 runtime 阶段的 prompt 问题。
- **不**改变 Phase 0 的行为。Phase 0 只 Read lines 1-50 是合理的（它只需要 frontmatter 里的 acts_options）；问题在于 Phase 1 需要 re-Read，不在 Phase 0 太节俭。
- **不**提供静态分析工具验证 LLM 确实全读了（那是 telemetry 层的事，超出本 change）
- **不**做 Phase 2 的读取修复。Phase 2 读 state.yaml 和 script.yaml 的行为跟这个问题无关。

## Decisions

### Decision 1: 显式预算授权 vs 只说"全读"

**选项对比**：
- (a) "请完整读取所有文件" —— 单纯的正向指令
- (b) "本阶段需 Read 约 N 个文件 / M KB 文本；你有 1M 上下文，这 < 15%；**不要节省，全量读**" —— 预算 + 授权 + 禁令

**选 (b)**。理由：

- LLM 的 `offset/limit` 默认是**防御性行为**（怕炸 context），单纯说"全读"不会触发它主动关闭防御
- 消除防御需要 **显式授权 + 规模告知**。LLM 看到"你有 1M，只用 10%"会主动关闭节俭模式
- packager 在生成时已知道角色数 + world 文件数 + 每个文件大小，可以计算出精确的预算数字
- 具体数字比抽象保证更有说服力：LLM 对"约 120 个文件 / 400KB"会做出不同于"很多文件"的决策

### Decision 2: 预算数字来自 packager 而不是 runtime

预算数字由 packager 在生成 SKILL.md 时计算一次，写入 prompt 作为字面字符串。替代方案是让 LLM 在 runtime 用 Glob 自己数。

**选 packager 侧计算**。理由：

- packager 100% 准确，知道每个文件的字节数
- runtime Glob 再数一次是 tool call 开销，且结果可能跟实际 Read 脱节
- packager 侧数字是"生成时的真相"；skill 运行时如果用户手动删了文件，差异会暴露出来，这反而是好事

### Decision 3: Step 0 数据加载报告 vs 隐式信任

**选项对比**：
- (a) 只给 prompt 指令"请全量 Read 所有文件"，相信 LLM 会做
- (b) 加一个 Step 0：LLM 必须在进入 Step 1 前**显式输出一个加载报告**，列出 Read 过的每个文件 + 行数

**选 (b)**。理由：

- 这是现在 SKILL.md 架构里最轻的 enforcement 机制：**让 LLM 在能进入下一步之前，必须输出一段证明它做过的 meta-text**
- LLM 不能输出"我读了 identity.md 120 行"而实际没读，因为它要写出 120 这个数字需要真的读过才能拿到
- 参考模式来自 Phase 1 Step 5 的 7 重自检 —— 自检机制是 prompt 工程里行之有效的 "make LLM do the work to prove the work"
- Step 0 的输出格式稍后会被 Step 5.h 的自检 reference，形成一个闭环：**Step 0 声明 → Step 5.h 验证**

### Decision 4: Step 5.h 新增（多角色）/ Step 5.e 新增（单角色）

现在的 Step 5 自检：
- 多角色引擎：5.a (共享 axes) / 5.b (flags) / 5.c (consequences key) / 5.d (聚合 DSL) / 5.e (flag 白名单) / 5.f (initial_state) / 5.g (prose_style 反例对照)
- 单角色引擎：5.a (consequences key) / 5.b (flags 白名单) / 5.c (initial_state) / 5.d (prose_style 反例对照)

新增：
- 多角色：**5.h — 数据覆盖完整性**
- 单角色：**5.e — 数据覆盖完整性**

自检内容：
1. 对照 Step 0 的加载报告，验证每个角色的 identity / style / behaviors 文件都有记录
2. 对每个文件的记录行数做 sanity check（identity.md 典型 > 80 行；style.md 典型 > 60 行；behaviors/*.md 典型 > 30 行）
3. 看到任何文件 < 50 行 → 大概率是 limit 参数漏网 → **不修 schema，直接重新 Read 那个文件**，然后更新 Step 0 报告，重新跑 5.h

### Decision 5: Phase 0 污染的 3 种修法

**选项对比**：
- (a) Phase 0 改成只从 story-spec.md 的 frontmatter 精确范围 Read —— 从根上避免污染
- (b) Phase 0 不变，Phase 1 开头加一句 "忽略之前 Phase 0 对 story-spec.md 的部分读取，重新 Read 整个文件" —— 用 Phase 1 的显式指令抵消污染
- (c) SKILL.md 告诉 LLM "Phase 0 不要 Read，acts_options 会作为 Phase 0 的 prompt 一部分直接传给你" —— 从设计上避免 Phase 0 Read

**选 (b)**。理由：

- 最小改动，只加一句
- 不改变 Phase 0 行为，避免引入新 bug
- 对"LLM 是否会响应 re-Read 指令"这个不确定性是 safe 的：即使 LLM 记得 cache，看到 "重新 Read" 最坏情况也就是重复一次 Read，不伤害
- (a) 需要 LLM 在 Phase 0 用精确的 offset+limit 指定 frontmatter 范围，反而引入新的分页责任
- (c) 需要 packager 把 acts_options 注入 SKILL.md 硬编码，破坏 story-spec.md 作为唯一真相源的设计

### Decision 6: 模板现有 "读数据" 段是否保留 numbered list

现在的 "读数据" 段是一个清单：

```
1. 每个角色的人格资料：
   - ...
2. world/... .md
3. world/history/timeline.md
4. ...
5. story-spec.md
```

**保留这个清单**，但是把它**降级为文件清单**，把 enforcement 放到新增的 Step 0 上。清单还是有用（告诉 LLM 有哪些类别），只是不再是唯一的 enforcement 点。

### Decision 7: packager 计算 expected_file_count 的精确度

**选项对比**：
- (a) 精确：packager 实际 glob 所有要打包的文件，数一下
- (b) 估算：基于 character count + world entries count 简单算 character_count × 9 + world_entries + 5

**选 (a) 精确**。理由：

- packager 已经在 walk 文件系统做打包，加一个计数几乎零成本
- 精确数字比估算更有说服力（"预计 137 个文件" 比 "约 120 个文件" 让 LLM 更信任）
- 不需要维护估算公式的魔法常数

对应地 `expected_text_size_kb`：在 packager walk 文件时累加每个 md 的 byteLength，最后除 1024 取整。

## Risks / Trade-offs

| Risk | Mitigation |
|---|---|
| LLM 忽略 Step 0 指令，跳过加载报告直接进 Step 1 | Step 1 的开头加一句"如果你没有先输出 Step 0 加载报告，立刻停下来回去做 Step 0"。软 enforcement，但对 prompt-following 好的模型（如 Claude Opus）够用 |
| LLM 在 Step 0 报告里虚报行数（"我读了 identity.md 100 行"但实际没读） | 不可完全防范。但 LLM 要写出具体数字需要真的 Read 过才拿得到；虚报等于它凭空编造行数，与"先 Read 再报数"在训练损失上同等困难。风险可接受 |
| 预算数字写错（packager 和 runtime 文件数不一致，比如用户在 skill 加载后删了文件） | Step 5.h 的 sanity check 会捕获：如果 Step 0 报告的文件数 ≠ 预算数字 ± 2，说明有漂移，要求 LLM 重新 Glob 核对 |
| Step 0 meta-output 变成大段枯燥文本，污染用户视线 | 规定 Step 0 输出只对 Claude 自己可见的"思考"，模板里明确说"这个报告是你的 planning 输出，不需要向用户展示"。Claude 的默认行为会把这类声明放在 thinking/tool call 之前，不直接打扰用户 |
| re-Read story-spec.md 增加一次 tool call 开销 | 可接受。1-2 次额外 Read 相对于整个 Phase 1 的 tool loop 是可忽略开销 |
| 新 Step 0 加长 SKILL.md 模板，逼近 size limit | SKILL.md 当前 ~40KB，Step 0 和 Step 5.h 新增大约 2KB。Anthropic Skill spec 没有硬 size 上限，当前不是 blocker |
| packager 新增的 file-count 估算对已有 export 产生 behavior 差异 | 是否向后兼容旧 export？否 —— 但 packager 新字段是生成时写死的，已归档的 skill 里的 SKILL.md 不会被改。影响面：只有新 export。这符合我们"杜绝翻译腔"的 universal principle |

## Open Questions

- Step 0 报告的精确格式要不要强制结构化（yaml? markdown table? 自由文本）？倾向 markdown table，便于 Step 5.h 用正则或结构化查找
- 当某个 optional 文件真的不存在时（`capabilities.md` 或 `milestones.md` 在某些 soul 里缺），Step 0 报告怎么表达？倾向明确列出 "(not present)" 让 Step 5.h 认得
- 是否需要给 LLM 一个 "你看到的 Read 结果 < 预期 → 这就是 limit 漏网的信号" 的启发式？可以在 Step 5.h 的描述里显式写出来
- 这个 change 跟 prose-style-anchor 是 "修 prose-style-anchor 失效的根因"，要不要在 CLAUDE.md 的 change log 里明确标注这个因果关系？
