## MODIFIED Requirements

### Requirement: 注入顺序
Context Assembler SHALL 按以下固定顺序组装 system prompt：
1. World always entries（background + rule scope，按 world.order 排序）
2. **World chronicle 底色块**（chronicle scope + always mode 的 entry 按 sort_key 升序聚合渲染为单个块；多世界场景下按 world.order 分组）
3. Binding persona_context（模板渲染后）
4. Soul identity.md
5. Soul style.md
6. Soul behaviors/*.md
7. World keyword/semantic 命中条目（按 effective_priority 排序，含 chronicle 详情条目）
8. Soul chunk recall 结果
9. World atmosphere scope 条目

#### Scenario: 多世界 always 条目排序
- **WHEN** world A（order: 0）和 world B（order: 1）各有一个 always 条目
- **THEN** world A 的 always 条目在 world B 之前

#### Scenario: chronicle 底色聚合渲染
- **WHEN** 一个世界有 5 条 chronicle timeline 条目（sort_key 分别为 2013、2020、2023、2077、2099）
- **THEN** Context Assembler SHALL 把这 5 条按 sort_key 升序拼接为单个 markdown 块
- **AND** 该块紧跟在 background+rule 块之后注入
- **AND** 块的标题来自 i18n key `world.chronicle.title`（缺省 "编年史"）

#### Scenario: 多世界 chronicle 排序
- **WHEN** world A（order 0）和 world B（order 1）都有 chronicle timeline
- **THEN** A 的 chronicle 块在 B 的 chronicle 块之前
- **AND** 每个世界内部按各自的 sort_key 排序

#### Scenario: chronicle 详情走 keyword 路径
- **WHEN** 一个 chronicle events entry 的 keyword 命中用户输入
- **THEN** 该 entry SHALL 与普通 lore entry 一同放置在第 7 步（按 effective_priority 排序）
- **AND** 不参与第 2 步的 chronicle 底色聚合

#### Scenario: 老世界无 chronicle 时降级
- **WHEN** 一个绑定的世界没有 chronicle/timeline 目录
- **THEN** Context Assembler SHALL 跳过第 2 步（不渲染空标题，不输出占位文本）
- **AND** 其他步骤照常

#### Scenario: chronicle 底色 entry 的 display_time 显示
- **WHEN** 一个 chronicle timeline entry 的 display_time 为 "2020 年 8 月"
- **THEN** 注入到 LLM 的文本 SHALL 包含 "2020 年 8 月"，不暴露 sort_key 数值
- **AND** entry 的 body（一行事件描述）紧随其后

## ADDED Requirements

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
