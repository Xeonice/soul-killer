## ADDED Requirements

### Requirement: Context Assembler
系统 SHALL 提供 `ContextAssembler` 类，替换现有的 `buildSystemPrompt` 函数，统一管理 system prompt 的构建。接收 soul files、已绑定的 world 列表、当前对话历史和用户输入，输出完整的 system prompt 字符串。

#### Scenario: 无世界绑定时的行为
- **WHEN** soul 没有绑定任何世界
- **THEN** Context Assembler 的输出与原有 buildSystemPrompt 行为一致（仅包含 soul identity/style/behaviors）

#### Scenario: 有世界绑定时的完整组装
- **WHEN** soul 绑定了一个世界，该世界有 always 条目和 keyword 条目
- **THEN** system prompt 按以下顺序组装：world always entries → persona_context → soul identity → soul style → soul behaviors → triggered entries → recall results

### Requirement: 注入顺序
Context Assembler SHALL 按以下固定顺序组装 system prompt：
1. World always entries（background + rule scope，按 world.order 排序，从所有维度子目录加载）
2. **World chronicle 底色块**（从 `history/timeline.md` 加载，按 sort_key 升序聚合渲染为单个块；多世界场景下按 world.order 分组）
3. Binding persona_context（模板渲染后）
4. Soul identity.md
5. Soul style.md
6. Soul behaviors/*.md
7. World keyword/semantic 命中条目（按 effective_priority 排序，含 chronicle 详情条目——从 `history/events/` 加载）
8. Soul chunk recall 结果
9. World atmosphere scope 条目

`loadAllEntries` SHALL 遍历所有维度子目录并跳过 `_` 前缀文件、`history/events/` 子目录、`history/timeline.md` 单文件。`loadChronicleTimeline` SHALL 解析 `history/timeline.md` 的 `## ` 段落。`loadChronicleEvents` SHALL 枚举 `history/events/*.md`。runtime 的装配逻辑（scope/mode/priority 过滤、token budget、注入顺序、去重）与旧版保持完全一致。

#### Scenario: 多世界 always 条目排序
- **WHEN** world A（order: 0）和 world B（order: 1）各有一个 always 条目
- **THEN** world A 的 always 条目在 world B 之前

#### Scenario: chronicle 底色聚合渲染
- **WHEN** 一个世界的 `history/timeline.md` 有 5 个段落（sort_key 分别为 184、200、208、220、234）
- **THEN** Context Assembler SHALL 把这 5 条按 sort_key 升序拼接为单个 markdown 块
- **AND** 该块紧跟在 background+rule 块之后注入
- **AND** 块的标题来自 i18n key `world.chronicle.title`（缺省 "编年史"）

#### Scenario: 多世界 chronicle 排序
- **WHEN** world A（order 0）和 world B（order 1）都有 `history/timeline.md`
- **THEN** A 的 chronicle 块在 B 的 chronicle 块之前
- **AND** 每个世界内部按各自 timeline.md 的 sort_key 排序

#### Scenario: chronicle 详情走 keyword 路径
- **WHEN** 一个 `history/events/*.md` 的 keyword 命中用户输入
- **THEN** 该 entry SHALL 与普通 lore entry 一同放置在第 7 步（按 effective_priority 排序）
- **AND** 不参与第 2 步的 chronicle 底色聚合

#### Scenario: 老世界无 timeline.md 时降级
- **WHEN** 一个绑定的世界没有 `history/timeline.md` 文件
- **THEN** Context Assembler SHALL 跳过第 2 步（不渲染空标题，不输出占位文本）
- **AND** 其他步骤照常

#### Scenario: `_` 前缀文件不参与注入
- **WHEN** 某维度子目录下有 `_index.md`
- **THEN** `loadAllEntries` 不枚举该文件
- **AND** ContextAssembler 注入时不包含 `_index.md` 的内容

#### Scenario: chronicle 底色 entry 的 display_time 显示
- **WHEN** 一个 timeline.md 段落的 display_time 为 "208 年"
- **THEN** 注入到 LLM 的文本 SHALL 包含 "208 年"，不暴露 sort_key 数值
- **AND** entry 的 body（一行事件描述）紧随其后

### Requirement: Keyword 触发匹配
系统 SHALL 对 keyword 模式的条目进行字符串包含匹配（大小写不敏感）。匹配范围为用户当前输入 + 最近 3 轮对话内容。

#### Scenario: 当前输入命中
- **WHEN** 用户输入包含 "荒坂"，某条目 keywords 含 "荒坂"
- **THEN** 该条目被激活

#### Scenario: 历史对话命中
- **WHEN** 2 轮前的对话包含 "Arasaka"，某条目 keywords 含 "arasaka"
- **THEN** 该条目被激活（大小写不敏感匹配）

#### Scenario: 超出 3 轮范围
- **WHEN** 5 轮前的对话包含 keyword，但最近 3 轮和当前输入都不包含
- **THEN** 该条目不被激活

### Requirement: Semantic 触发匹配
系统 SHALL 对 semantic 模式的条目使用 engine 的 recall 能力。将条目内容作为 chunk 导入世界专属的 engine 实例，用户输入作为 query 进行相似度搜索。

#### Scenario: 语义召回命中
- **WHEN** 用户输入 "义体改造的风险" 与世界条目 "cyberware-risks" 的 TF-IDF 相似度 > 阈值
- **THEN** 该条目被激活并注入 context

### Requirement: 多世界条目优先级排序
多世界场景下，条目的有效优先级 SHALL 按公式 `(MAX_ORDER - binding.order) * 1000 + entry.priority` 计算。同名条目取 order 最小世界的版本。

#### Scenario: 同名条目去重
- **WHEN** world A（order: 0）和 world B（order: 1）各有名为 "magic" 的条目
- **THEN** 只保留 world A 的 "magic" 条目

#### Scenario: 优先级排序
- **WHEN** world A（order: 0）有条目 priority 100，world B（order: 1）有条目 priority 900
- **THEN** world A 的条目 effective_priority 更高，排在前面

### Requirement: Token Budget 管理
Context Assembler SHALL 为每个绑定世界分配 token 预算（默认 2000，可通过 binding overrides 覆写）。超预算时 SHALL 从低 effective_priority 条目开始裁剪。Token 估算使用字符数 ÷ 3。

#### Scenario: 超出单世界预算
- **WHEN** 世界 "night-city" 的 context_budget 为 2000 token，已激活条目总计约 3000 token
- **THEN** 从 effective_priority 最低的条目开始移除，直到总量 ≤ 2000 token

### Requirement: Entry Filter 应用
Context Assembler SHALL 在条目激活前应用 binding 的 entry_filter：`include_scopes` 限制只使用指定 scope，`exclude_entries` 排除特定条目，`priority_boost` 调整特定条目的 priority 值。

#### Scenario: Scope 过滤
- **WHEN** binding 设置 `include_scopes: ["background", "rule"]`
- **THEN** 只有 scope 为 background 或 rule 的条目参与激活，lore 和 atmosphere 条目被忽略

#### Scenario: Priority boost
- **WHEN** binding 设置 `priority_boost: { "megacorps": 500 }`
- **THEN** 条目 "megacorps" 的 entry.priority 在计算 effective_priority 时增加 500

### Requirement: chronicle 块的 token 预算
Chronicle 底色聚合块 SHALL 计入所属世界的 token 预算（与现有 entries 共用 binding.context_budget）。当超预算时，SHALL 按 entry effective_priority 升序裁剪 chronicle 底色 entry，与现有裁剪逻辑一致。

#### Scenario: chronicle 参与预算裁剪
- **WHEN** 一个世界的 context_budget 为 1500 token，但 background+rule+chronicle 总和达到 2000 token
- **THEN** 系统 SHALL 从最低 effective_priority 的 entry（无论是 background 还是 chronicle）开始移除，直到总量 ≤ 1500

### Requirement: chronicle entry 的 entry_filter 支持
Binding 的 `entry_filter.include_scopes` SHALL 接受 `'chronicle'` 作为合法值。设置后，只有 chronicle scope 的 entry 参与注入；不设置时所有 scope 默认参与。

#### Scenario: 仅注入 chronicle
- **WHEN** binding 设置 `include_scopes: ['chronicle']`
- **THEN** 只有 chronicle scope 的 entry（含底色和详情）参与激活
- **AND** background/rule/lore/atmosphere entry 被忽略
