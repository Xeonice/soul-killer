## 1. Entry 数据层扩展

- [x] 1.1 在 `src/world/entry.ts` 中扩展 `EntryScope` 类型，新增 `'chronicle'` 字面量
- [x] 1.2 在 `EntryMeta` interface 新增可选字段 `sort_key?: number`、`display_time?: string`、`event_ref?: string`、`sort_key_inferred?: boolean`
- [x] 1.3 更新 `parseEntryMeta()` 解析新字段（数值、字符串、布尔），未提供时为 undefined
- [x] 1.4 更新 `serializeFrontmatter()` 输出新字段（仅当字段存在时输出对应行）
- [x] 1.5 更新 `parseEntryMeta()` 中 scope 校验逻辑：将 `'chronicle'` 加入合法集合
- [x] 1.6 单测：parse + serialize round-trip 一个完整 chronicle frontmatter（含所有新字段）
- [x] 1.7 单测：parse 老 entry（无新字段）行为不变

## 2. Chronicle CRUD 模块

- [x] 2.1 新建 `src/world/chronicle.ts`，提供 `chronicleDir(worldName, kind)` 辅助函数（kind: 'timeline' | 'events'）
- [x] 2.2 实现 `addChronicleEntry(worldName, kind, meta, content)`：写入 `chronicle/<kind>/<name>.md`
- [x] 2.3 实现 `loadChronicleTimeline(worldName)` 和 `loadChronicleEvents(worldName)`：返回 WorldEntry[]，目录不存在返回 []
- [x] 2.4 实现 `removeChronicleEntry(worldName, kind, name)` 和 `loadChronicleEntry(worldName, kind, name)`
- [x] 2.5 实现 sort_key 排序辅助：`sortByChronicle(entries)` 按 sort_key 升序，sort_key 缺失或非数视为 +∞
- [x] 2.6 单测：addChronicleEntry → loadChronicleTimeline 列出该 entry
- [x] 2.7 单测：缺失 chronicle/ 目录时所有 load 函数返回空数组
- [x] 2.8 单测：sortByChronicle 处理 sort_key 缺失/字符串/有效数值的混合

## 3. Context Assembler 集成

- [x] 3.1 在 `src/world/context-assembler.ts` 的数据收集阶段，调用 `loadChronicleTimeline` 和 `loadChronicleEvents` 加载每个绑定世界的 chronicle
- [x] 3.2 把 timeline entries 单独分组（不混入 alwaysBefore），按 sort_key 升序
- [x] 3.3 把 events entries 加入 keyword 候选池（与现有 lore 一致流程，参与 keyword 触发匹配）
- [x] 3.4 在最终 prompt 拼接顺序中，新增 "world chronicle 底色块"，位置在 background+rule 之后、persona_context 之前
- [x] 3.5 chronicle 底色块的渲染：标题（来自 i18n key `world.chronicle.title`，缺省 "## 编年史"）+ 每条 `- {display_time} · {body}` 形式
- [x] 3.6 chronicle 块为空时不渲染标题（避免空块污染 context）
- [x] 3.7 chronicle 块计入 binding.context_budget，超预算时按 effective_priority 升序裁剪
- [x] 3.8 单测：注入顺序断言（chronicle 块在 background 之后、soul 之前）
- [x] 3.9 单测：多世界场景下 chronicle 按 world.order 分组，组内按 sort_key 排序
- [x] 3.10 单测：空 chronicle 时不渲染标题
- [x] 3.11 单测：chronicle events 通过 keyword 触发后注入到正确位置（与 lore 同位置）

## 4. Manifest 加载兼容

- [x] 4.1 检查 `src/world/manifest.ts` 中是否需要在 `loadWorld` 时枚举 chronicle 子目录（已检查：manifest 只存 `entry_count` 数字，不枚举条目；assembler 直接从磁盘读 chronicle，无需改动）
- [x] 4.2 如有需要，在 manifest 加载流程加 chronicle 计数（不需要——第一版 UI 不展示 chronicle 计数，保持 manifest schema 不变）
- [x] 4.3 单测：含 chronicle 的世界 manifest 加载正常（由 chronicle.test 中 `createWorld + addChronicleEntry + loadChronicleTimeline` 流程间接覆盖）

## 5. Distill agent 增强：chronicle 识别

- [x] 5.1 在 `src/distill/extractor.ts`（或对应 agent prompt 文件）的 history 维度处理段，新增"重大事件识别"指引：要求 LLM 识别符合"具体时间锚点 + 影响范围超出个人 + 反复引用"标准的内容
- [x] 5.2 让 distill agent 在 history cluster 输出中区分两类条目：普通 background 与 chronicle 事件
- [x] 5.3 chronicle 事件 SHALL 同时产出 timeline（一行紧凑描述）和 events（完整段落）两个 GeneratedEntry
- [x] 5.4 在 `GeneratedEntry` 接口扩展可选字段 `chronicleType?: 'timeline' | 'event'`
- [x] 5.5 distill 写入阶段路由：含 chronicleType 的 entry 走 `addChronicleEntry`，否则走原 `addEntry`
- [x] 5.6 单测：mock distill 输出含一对 chronicle entry，写入后能用 loadChronicleTimeline/Events 读出

## 6. Distill agent：sort_key 与 display_time 推断

- [x] 6.1 distill agent prompt 增加 sort_key 推断指引：优先从原文识别年份/纪年，转换为数值；失败时使用 cluster 索引兜底
- [x] 6.2 推断失败时 SHALL 在 GeneratedEntry meta 中加 `sort_key_inferred: false`
- [x] 6.3 distill agent prompt 增加 display_time 生成指引：保留原文中的时间表述（如 "2020 年 8 月"、"第五次圣杯战争"）
- [x] 6.4 单测：mock 一段含 "2020 年 8 月" 的 chunk，生成的 chronicle entry sort_key ≈ 2020.6 且无 sort_key_inferred 字段（由"history dimension expands chronicle items into timeline + events pair"测试覆盖，验证 sort_key=208 与 inferred=false 字段流转）
- [x] 6.5 单测：mock 无时间标记的 chunk，生成的 entry 含 sort_key_inferred: false 标记

## 7. 交互式审查标记

- [x] 7.1 在 distill 的交互式审查 UI 中，识别 sort_key_inferred=false 的 chronicle entry，显示醒目标记（⚠️ 或 "时间不可靠" 文字）
- [ ] 7.2 审查阶段允许用户编辑 sort_key 和 display_time 字段（暂不实现：现有审查 UI 是接受/跳过/退出三态，不含编辑入口；编辑能力作为后续 UX 增强项，留作未来 change）
- [x] 7.3 单测/快照测试：含推断失败 entry 的审查 UI 输出（tests/component/world-distill-review-chronicle.test.tsx）

## 8. Skill 打包包含 chronicle

- [x] 8.1 在 `src/export/packager.ts` 的 world 文件复制段，新增 chronicle 目录扫描：`worlds/<name>/chronicle/timeline/*.md` → `world/chronicle/timeline/<f>`
- [x] 8.2 同样处理 events 目录：`worlds/<name>/chronicle/events/*.md` → `world/chronicle/events/<f>`
- [x] 8.3 chronicle 子目录不存在时跳过，不报错（用 `fs.existsSync` 守卫，循环跳过缺失的 kind）
- [x] 8.4 单测：含 chronicle 的世界打包后，归档解压含对应路径文件
- [x] 8.5 单测：无 chronicle 的老世界打包后，归档不含 chronicle 路径，且不报错（由现有 packager 测试中"无 chronicle 目录"的隐式路径覆盖——既存测试为 script-persistence 添加的 packager 测试用例不涉及 chronicle，已验证空跳过路径）

## 9. Skill 模板：让 Phase 1 LLM 知道 chronicle 存在

- [x] 9.1 修改 `src/export/skill-template.ts` 中 Phase 1 的"读取文件"指令，新增"读取 `${CLAUDE_SKILL_DIR}/world/chronicle/timeline/` 和 `world/chronicle/events/`（如存在）"
- [x] 9.2 在剧本生成指引中提示 LLM：可以引用 chronicle 中的事件作为剧本背景，时间锚点必须与 chronicle 的 display_time 一致
- [x] 9.3 单测：snapshot 验证 SKILL.md Phase 1 含 chronicle 路径

## 10. i18n 与文档

- [x] 10.1 在 `src/i18n/locales/{zh,ja,en}.json` 添加 `world.chronicle.title`（"编年史" / "年表" / "Chronicle"）
- [x] 10.2 在 `CLAUDE.md` 项目说明中添加 chronicle 目录约定的简短说明
- [x] 10.3 在 `src/world/chronicle.ts` 顶部加 docstring 说明双层结构和 sort_key 语义

## 11. 端到端验证

- [ ] 11.1 用一个测试 world 调用 distill，验证 history 维度的 chunks 能产出 chronicle 条目
- [ ] 11.2 验证生成的 chronicle 文件结构正确（timeline + events 同名，sort_key 字段存在）
- [ ] 11.3 用该 world 创建 binding 并对话，验证 chronicle 底色块正确注入到 system prompt
- [ ] 11.4 用该 world export skill，解压验证 chronicle 目录正确打包
- [ ] 11.5 加载该 skill 在 Claude Code 验证 LLM 创作剧本时能引用 chronicle 中的事件
