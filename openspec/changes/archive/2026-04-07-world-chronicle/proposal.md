## Why

当前 World 系统的 `history` 维度只是个内容分类标签——它产出的 entry 是散文式的"夜之城的历史是从 2020 年战争开始..."，没有时间结构。LLM 看到的是模糊的叙述，无法按时间顺序引用世界事件，story 生成时也没有"哪一年发生了什么"的硬骨架。用户需要的是真正的**编年史**：xx 年 xx 人做了什么，作为左右世界局势的大事件被结构化记录。这一层是 export skill 时 LLM 创作剧本的关键素材——剧本里"V 站在 2077"、"圣杯战争第五次"这种时间锚点必须有可信的世界档案做后盾。

## What Changes

- 新增**编年史目录** `chronicle/`：每个世界 SHALL 在 `~/.soulkiller/worlds/<name>/chronicle/` 下维护两类文件：
  - `chronicle/timeline/<event-slug>.md` — **底色层**，一行一事件的紧凑条目，always 注入
  - `chronicle/events/<event-slug>.md` — **详情层**，对应底色事件的完整描述，按 keyword 触发召回
- 新增 EntryScope 值 `'chronicle'`：与现有 background/rule/lore/atmosphere 并列，专门用于编年史条目
- 新增 entry frontmatter 字段：
  - `sort_key: number` — 时间轴上的纯数值位置，用于排序与未来的硬时间过滤
  - `display_time: string` — 给 LLM 看的展示文本（"2020 年 8 月"、"第四纪元 3019"），与 sort_key 解耦
  - `event_ref?: string` — 底色 entry 通过此字段指向详情 event 的 slug，建立两层关联
- **World distill agent 增强**：识别"重大事件"并产出 chronicle 条目（同时输出底色 + 详情两个文件）；自动推断 sort_key 数值；推断失败时使用合理回退值并标记为 `sort_key_inferred: false`
- **Context Assembler 集成**：
  - chronicle 底色层（timeline）总是 always 注入，作为 world always 块的子分组，按 sort_key 升序排列
  - chronicle 详情层（events）按 keyword 触发，与现有 lore 条目机制一致
  - 注入顺序：现有 background+rule → **chronicle 底色（新增）** → keyword/semantic 命中 → atmosphere
- **不引入硬时间闸门**（current_time 过滤）— 那是后续 change 的范围；本 change 只交付"档案 + 注入"

## Capabilities

### New Capabilities
- `world-chronicle`: 编年史数据模型、目录结构、底色/详情两层 entry 关联机制和 distill 生成规则

### Modified Capabilities
- `world-entry`: EntryScope 新增 `'chronicle'`；EntryMeta 新增 `sort_key` / `display_time` / `event_ref` 字段；frontmatter 解析和写入支持新字段
- `world-distill`: 蒸馏阶段新增 chronicle 识别能力，从历史维度的 chunks 中提取重大事件，生成成对的 timeline + events 条目，自动推断 sort_key
- `world-context-assembly`: 注入顺序中插入 chronicle 底色层（在 background/rule 之后、keyword 之前），支持按 sort_key 升序排序

## Impact

**代码**：
- `src/world/entry.ts` — frontmatter 解析/写入支持新字段；EntryScope 类型扩展
- `src/world/distill.ts` 和 `src/distill/extractor.ts` / `src/distill/generator.ts` — chronicle 识别与生成逻辑
- `src/world/context-assembler.ts` — 注入顺序变更，加入 chronicle 底色块
- `src/world/manifest.ts` — 加载世界时枚举 chronicle/timeline 和 chronicle/events 目录
- 新增 `src/world/chronicle.ts`（可选）— chronicle 专属的目录管理与 sort_key 推断辅助
- `src/tags/world-taxonomy.ts` — 在 history 维度的描述里说明会触发 chronicle 生成

**Skill 导出（无需改 export 代码）**：
- `src/export/packager.ts` 已经会复制 `world/entries/`，需要扩展为也复制 `world/chronicle/{timeline,events}/`
- export 后 LLM 在 Phase 1 创作剧本时能看到完整 chronicle，剧本里的时间锚点更准确

**对现有世界的影响**：
- 已有的 history 维度散文 entry 保留，不强制迁移
- 用户对老世界 evolve 时，distill agent 可以新生成 chronicle 条目并与旧 history 共存
- 老世界没有 chronicle 目录时，加载和注入流程 SHALL 优雅降级（视为空目录）

**用户体验**：
- LLM 在对话和剧本生成中能引用具体年份与事件，世界感更强
- 一行一事件的底色让 LLM 一眼看到世界时间脉络
- 详情层在用户聊到某个事件时才召回，不会撑爆 always 块的 token 预算
