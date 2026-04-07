## Context

Soulkiller 的 World 系统目前有 9 个 distill 维度（geography / history / factions / systems / society / culture / species / figures / atmosphere）。`history` 维度产出散文式 entry：所有事件压缩成一段叙述塞进一个 entry 的 body。这种做法的缺陷在 export skill 时尤其明显——LLM 创作剧本需要明确的"哪一年发生了什么"作为时间锚点，否则剧本里的历史引用容易自相矛盾或与世界观脱节。

相关现状：
- `src/world/entry.ts` 定义 `EntryScope = 'background' | 'rule' | 'lore' | 'atmosphere'`，frontmatter 解析支持 string/number/array
- `src/world/context-assembler.ts` 按 scope 分组：background+rule 走 alwaysBefore（在 soul 之前注入），atmosphere 走最后，lore/keyword 走中间
- `src/world/distill.ts` 调用 distill agent，agent 通过 `WORLD_DIMENSIONS` 表生成 entry，每个 entry 自动带上 `dimension` 字段
- `src/export/packager.ts` 复制 `world/entries/*.md` 到 skill 归档，但**不复制**任何 chronicle 类目录

设计核心问题：在不破坏现有 entry 系统的前提下，**新增一种特殊用途的"双层"entry 类型**，既能 always 注入（底色），又能按 keyword 召回（详情），还要为未来的硬时间过滤预留 sort_key 字段。

## Goals / Non-Goals

**Goals:**
- 编年史作为世界的可信时间档案，结构化记录"xx 年 xx 人做了什么"
- 双层结构：底色层（紧凑、always 注入）+ 详情层（完整、按需召回）
- sort_key 数值字段，作为未来硬时间过滤的基础设施
- 异世界友好（魔戒纪元、Fate 圣杯战争编号等都能用）
- 老世界向前兼容（无 chronicle 目录时优雅降级）
- 蒸馏 agent 能从 history 维度的 chunks 自动识别重大事件并产出成对条目
- export 时 chronicle 随 skill 一起打包，让 Phase 1 LLM 看到完整时间档案

**Non-Goals:**
- 不引入硬时间闸门（current_time 过滤）— 那是后续 change，本 change 只是把"档案"建好
- 不把 chronicle entry 接到 sort_key 之外的任何条件触发（按 sort_key 过滤是后续工作）
- 不强制迁移老世界的 history 散文 entry — 它们与 chronicle 共存
- 不为 chronicle 设计独立的 distill pipeline — 复用现有 distiller，只是新增识别和生成步骤
- 不引入"事件因果链"等复杂关系建模 — sort_key 排序就是关系
- Soul era（同一个人不同时期的分身）不在范围内

## Decisions

### Decision 1: 双层结构（timeline + events）作为两个独立目录

**选择**：
```
worlds/<name>/
├── entries/                       ← 现有 entries 不动
└── chronicle/                     ← 新增
    ├── timeline/                  ← 底色层
    │   ├── 2013-corp-war.md
    │   ├── 2020-arasaka-nuke.md
    │   └── 2077-v-relic.md
    └── events/                    ← 详情层
        └── 2020-arasaka-nuke.md   ← 与 timeline 同名建立关联
```

**理由**：
- 底色和详情**职责完全不同**：底色总是注入（一行的紧凑信息），详情按需召回（完整段落）。两个目录天然分轨。
- 底色和详情**不强制 1:1**：有些事件可能只有底色没有详情（次要事件），有些可能多个详情对应一个底色（深入剖析的扩展）。但默认 1:1，slug 同名建立关联。
- 复用现有的 entry 加载/解析机制：每个 chronicle 目录里都是普通 entry md 文件，只是 scope 是新的 `'chronicle'` 值
- 不用一个大 timeline.md 装一堆事件 — 那会让 keyword 触发只能拉整个文件，无法精准召回单个事件

**被否决的替代方案**：
- 一个 `chronicle.md` 文件 + body 里塞所有事件 → 探索时已经决定不这么做（context assembler 不应该做 entry 内部裁剪）
- chronicle 完全用现有 entries/ 目录承载（只加 scope 区分）→ 目录区分能让"是否参与编年史"一眼可见，也方便 distill / export / 删除时整体操作

### Decision 2: 底色 entry 的 body 是"一行 + 引用"

底色 entry 的 body 极简，例如：

```markdown
---
name: 2020-arasaka-nuke
scope: chronicle
mode: always
priority: 950
sort_key: 2020.613
display_time: "2020 年 8 月"
event_ref: 2020-arasaka-nuke
---

2020 年 8 月 · 荒坂塔核爆，Johnny Silverhand 战死
```

**注入时的拼接**：Context Assembler 把多个底色 entry 的 body 按 sort_key 升序拼接成一个块：

```
## 编年史（{world.display_name}）
- 2013 · 第四次公司战争爆发
- 2020 年 8 月 · 荒坂塔核爆，Johnny Silverhand 战死
- 2077 · V 植入 Relic
```

**理由**：
- LLM 看到的是"一段时间轴"，不是分散的 entry
- 每个底色 entry 仍然是原子的（独立文件、可单独删/改），但渲染时聚合
- `event_ref` 字段是给系统看的"指针"，不渲染给 LLM
- 这种"虚拟聚合"在 explore 阶段已经讨论过，是 entry 原子性 + 总览感的折中

### Decision 3: sort_key 是数值，不约束含义

```yaml
sort_key: 2020.613       # 例：地球纪年 8/13 ≈ 0.613
sort_key: 5.0            # 例：Fate 第五次圣杯战争
sort_key: 3019           # 例：魔戒第三纪元 3019 年
```

**理由**：
- 系统只用 sort_key 做排序和未来的范围过滤，不解析其语义
- 由 distill agent 在生成时**推断**一个合理数值；推断失败时使用回退（如同名 entry 中 alphabetical 顺序作为微调）
- 显示给 LLM 看的是 `display_time` 字符串，sort_key 不暴露
- 异世界历法可以用任意单调递增的数轴

**推断策略**（distill agent 内部）：
- 优先：从原文里找到具体年份/纪年文本，转换为数值
- 次选：根据上下文（"在战争之后"、"圣杯战争前"）相对定位
- 兜底：用 cluster 的源 chunk 索引作为伪 sort_key，并在 frontmatter 里加 `sort_key_inferred: false` 标记，让用户审核时可以修正

### Decision 4: 新增 EntryScope 值 `'chronicle'`

```ts
export type EntryScope = 'background' | 'rule' | 'lore' | 'atmosphere' | 'chronicle'
```

**理由**：
- chronicle 既不是 background（不是世界设定）也不是 lore（不是按需的知识条目）也不是 rule（不是约束）— 它是**时间档案**，需要独立的注入位置和渲染逻辑
- 显式 scope 让 context assembler 知道"对这些 entry 走 chronicle 渲染分支"
- 也让用户在 entry filter（include_scopes / exclude_scopes）里能精确控制是否使用编年史

### Decision 5: 注入顺序

新的固定顺序（在现有顺序里插入 chronicle 块）：

```
1. World background+rule always entries
2. ★ World chronicle 底色块（按 sort_key 升序聚合渲染） ★
3. Binding persona_context
4. Soul identity / style / behaviors
5. World keyword/semantic 命中条目（含 chronicle 详情层）
6. Soul chunk recall
7. World atmosphere
```

**理由**：
- 底色紧跟 background — 都是"世界基础事实"，时间档案是其中一种
- 底色在 soul 之前注入，让 LLM 在角色之前先建立时间观念
- 详情层（chronicle events）走 keyword 触发链路，与 lore 同位置
- chronicle 详情召回时不再做特殊聚合（每个详情就是一个完整的故事段落）

### Decision 6: distill agent 的 chronicle 生成是 history 维度的扩展，不是新维度

**选择**：保留 9 个维度不变。在 history 维度的 cluster 处理阶段，agent 多走一步——把"重大事件"识别出来，输出成对的 timeline + events 条目；其他 history 内容（散文式的世界历史背景）继续作为 background entry 输出。

**理由**：
- 不打破"9 个维度"的对外契约
- history 维度的 chunks 是同一批源数据，只是产出更细化
- agent prompt 里加一段"识别重大事件的指引"即可，不需要新的 dimension 类型

**重大事件的判定标准**（写进 distill agent prompt）：
- 涉及具体时间锚点（年份/纪年/历法）
- 影响范围超出个人（涉及势力、国家、文明级别）
- 在世界后续叙事中被反复引用

不符合这些标准的"历史"内容继续走原有的 background entry 路径。

### Decision 7: 老世界向前兼容

老世界的目录里没有 `chronicle/` — 加载流程必须不报错：
- `loadAllEntries` 已存在，新增 `loadChronicleTimeline` / `loadChronicleEvents` 函数，目录不存在时返回空数组
- Context Assembler 里：chronicle 块为空时整个 chronicle 章节都不渲染（不输出空标题）
- export 时：packager 检查 chronicle 子目录是否存在，存在才打包

老世界的 history 散文 entry 保留不动。用户对老世界 evolve 时，agent 可以新生成 chronicle 条目；如果与现有 history entry 内容重叠，复用 evolve 流程的"保留/替换/合并"提示。

### Decision 8: distill agent 把 chronicle 作为一个新的产出类型

`GeneratedEntry` 接口扩展可选字段：

```ts
interface GeneratedEntry {
  meta: EntryMeta              // 现有
  content: string              // 现有
  chronicleType?: 'timeline' | 'event'   // 新增
  // chronicleType 决定写入 chronicle/timeline/ 还是 chronicle/events/
}
```

写入阶段根据 `chronicleType` 决定目标目录；缺省走原有 `entries/` 路径。

## Risks / Trade-offs

**[Risk] LLM 推断 sort_key 不可靠** → 推断失败时打 `sort_key_inferred: false` 标记，distill 的交互式审查阶段把这些 entry 优先展示给用户审核。回退值用 cluster 索引，至少保证排序稳定。第一版只要"能排"就够，精确度作为后续优化。

**[Risk] chronicle 总是注入会撑大 system prompt** → 底色层每条只有一行（约 30-50 字符），即使 50 个事件也只 1.5-2.5k 字符，约 500-800 token。可接受。如果某个世界事件极多，可以在 binding 的 `context_budget` 里通过 `priority_boost` / `exclude_entries` 裁剪。

**[Risk] 老世界缺失 chronicle 时 export 出来的 skill 缺少时间档案** → 这是渐进迁移的代价。文档里说明：建议对老世界跑一次 `world evolve` 让 distiller 补充 chronicle。Skill 在缺失 chronicle 时仍然能跑，只是剧本里的时间锚点会模糊一些。

**[Trade-off] 新增 scope 值是 breaking-ish 变更** → EntryScope 类型扩展是 additive，老 entry 不会失效。但所有匹配 scope 的代码（context assembler、entry filter）都要确认能处理新值。覆盖测试：context assembler 现有的 background/rule/atmosphere/lore 分支必须明确不被 chronicle 误命中。

**[Trade-off] 双目录而非单目录增加复杂度** → 是的，但底色和详情的注入路径不同，强行合并到一个目录会让加载逻辑有更多 if-else。两个目录在概念上更清晰。

## Migration Plan

不需要数据迁移。新世界自动产生 chronicle；老世界缺失 chronicle 时所有相关代码走"空数组"路径。

实现顺序：

1. **数据层** — `entry.ts` 加新字段、新 scope；`chronicle.ts` 新文件提供 chronicle 专属 CRUD（loadTimeline / loadEvents / addChronicleEntry）
2. **加载层** — `manifest.ts` 在加载世界时同时枚举 chronicle 目录；为 ContextAssembler 提供数据
3. **注入层** — `context-assembler.ts` 在注入流程中插入 chronicle 底色聚合块
4. **生成层** — distill agent prompt 增加 chronicle 识别指引，extractor/generator 支持 chronicleType 字段，写入阶段路由到正确目录
5. **打包层** — `packager.ts` 复制 `world/chronicle/timeline/*` 和 `world/chronicle/events/*` 到 skill 归档
6. **测试** — 单测覆盖：解析新字段、空 chronicle 降级、注入顺序、双目录加载、distill 产出 chronicleType

每一步都向前兼容，不需要大爆炸式迁移。

## Open Questions

- **底色 entry 的 priority 默认值**：建议 `950`（高于普通 background 的 100，但低于 hard-coded 的 always 1000），让用户通过 priority 仍能微调。OK 吗？
- **是否在 chronicle 详情 entry 里强制要求 keyword 字段非空**：默认是的（否则没法触发），但如果 distill agent 推断不出关键词，用 entry name 作为单一 keyword 兜底。
- **是否在 binding 的 entry_filter 增加 `include_chronicle: boolean`**：第一版我倾向不加（用现有 `include_scopes` 加 `'chronicle'` 即可），保持 binding 配置最小集。
- **i18n**：底色聚合块的标题用"编年史"还是"年表"？建议读 i18n key `world.chronicle.title`，默认中文为"编年史"。
