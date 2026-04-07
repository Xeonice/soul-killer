## MODIFIED Requirements

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
