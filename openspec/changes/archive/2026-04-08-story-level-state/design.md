## Context

`state-schema-edit-stable` 做到了"state 存储合规"——每个 script 有显式 schema、字段名是字面字符串、Edit 工具保证原子更新。但它没有改变一件事：**state 的设计权在谁手里**。

当前流程下：
- Export agent 的 LLM 决定每个角色的 axes 名字（通过 `set_character_axes` 工具）
- Phase 1 的 LLM 在运行时决定 flags 的名字和初值（自由创造）
- 作者完全不参与 state 设计

这导致两个真实观察到的问题：
1. **fsn 案例中**：伊莉雅的 axes 叫 `bond/trust/self_worth`，凛的叫 `affection/understanding/rationality`。想写 "所有角色都接纳主角" 的结局时，无法用一个统一的维度聚合
2. **flags 设计权在 Phase 1**：export agent 生成 SKILL.md 时不列出 flags，Phase 1 LLM 临时造。作者看结局判定时发现 "illya_acknowledges_sisterhood" 这种 flag 是 LLM 现场编的

探索阶段用户明确表达了状态机心智模型（"故事是状态机，state 是精确变量，ending 是当 state 满足 X 时触发"）。在这个心智模型下：
- state 应该是 design-time 决定的（作者或 export agent 预定义）
- transitions 是 design-time 定义的（哪些 flag 什么时候被触发）
- condition 判定是 design-time 写好的（不是 LLM 运行时自由发挥）

相关代码：
- `src/agent/export-agent.ts` — export agent 的 system prompt + ExportBuilder + tools 定义
- `src/export/story-spec.ts` — StoryMetadata / CharacterSpec / StorySpecConfig interface；story-spec.md 模板生成
- `src/export/skill-template.ts` — SKILL.md 模板生成，含 `buildStateSchemaSection` / `buildEndingsDslSection` / `buildPhaseMinusOne`
- `src/export/lint/lint-skill-template.ts` — 模板 lint 规则

## Goals / Non-Goals

**Goals:**
- 所有角色共享 3 个 axes 维度，ending condition 可以跨角色聚合
- 关键事件 flags 在 export 阶段**一次性预定义**，Phase 1 LLM 不能创造新 flag
- 保留角色特异 axes（每个角色 0-2 个）作为 flavor，仍可进 ending condition
- Ending DSL 新增 `all_chars` / `any_char` primitive，支持 ALL/ANY 聚合判定
- Phase -1 加载时验证共享 axes 完整性 + flags 一致性，坏 script hard fail
- Export agent 工作流清晰分层：故事整体框架 → 故事状态 → 角色注册 → 角色轴 → 打包
- 跨平台不变（沿用 state-schema-edit-stable 的设计哲学）

**Non-Goals:**
- 不新增 UI（作者不手动填 flags，仍由 export agent LLM 预定义）
- 不改 Phase 2 场景流转机制（仍然用 Edit 工具行级更新）
- 不改 Phase 1 持久化格式（script.yaml 结构不变，只是 state_schema 块内容形态变）
- 不做 flag 间的 transition 规则（不限制"flag A 触发后才能触发 flag B"）
- 不引入 progress / chapter 状态字段（状态机模型下所有进度都靠 flags 表达）
- 不向后兼容旧 skill（hard fail 策略）
- 不支持 count/sum 等复杂聚合 primitive（YAGNI，all/any 够用）
- 不做 UI 手动填 flags 的选项 Z（保留为未来想法）

## Decisions

### Decision 1: 三层 state 结构

```
┌─ Layer 1: 共享 axes（跨角色）───────────┐
│   bond        (平台固定)                 │
│   <axis_a>    (故事级定义, story-defined)│
│   <axis_b>    (故事级定义)               │
│                                          │
│   所有角色必须含完整 3 个字段           │
│   initial 可 per-character 覆盖         │
└──────────────────────────────────────────┘

┌─ Layer 2: 角色特异 axes（0-2 个/角色）─┐
│   affinity.<char>.<specific>            │
│   纯 flavor，仍可进 ending condition    │
└──────────────────────────────────────────┘

┌─ Layer 3: Flags（故事级预定义）─────────┐
│   flags.<event_name>                    │
│   Soft cap ~8 个                        │
│   Phase 1 LLM 不能造新 flag             │
└──────────────────────────────────────────┘
```

**理由**：
- 共享 axes 提供跨角色聚合基准，直接解决痛点 B
- 特异 axes 保留角色刻画的表达能力（痛点 C 的妥协）
- Flags 统一在故事层预定义，解决痛点 C（设计权旁落）
- 三层职责清晰：共享 axes 表达关系状态的统一尺度、特异 axes 表达角色特定情感/成长、flags 表达关键事件

### Decision 2: bond 平台固定，另 2 个故事级定义（混合方案 γ）

**选择**：
```yaml
# 平台固定
"affinity.<char>.bond":   # 所有 soulkiller 故事都有
  desc: "亲密度"
  type: int
  range: [0, 10]
  default: 5

# 故事级定义（export agent 在 set_story_state 时填）
"affinity.<char>.<story_axis_a>":   # e.g. trust / loyalty / allegiance
"affinity.<char>.<story_axis_b>":   # e.g. rivalry / debt / suspicion
```

**理由**：
- bond 是最普适的"关系紧密度"概念，所有故事都有用
- 固定 bond 让作者写"所有角色都亲近主角"这种最常见的 condition 不需要学新语义
- 另外 2 个留给故事特色：fsn 可能用 `trust / rivalry`，赛博朋克用 `loyalty / debt`
- **拒绝的替代**：
  - α (完全平台固定) —— 失去故事定制感，赛博朋克故事硬套 trust/respect 不 fit
  - β (完全故事级) —— 跨故事不一致，作者每次都要重新学
- 混合是最实用的折中

### Decision 3: Flags 设计权归 export agent（方案 X）

**选择**：Flags 由 export agent 的 LLM 在 `set_story_state` 工具调用时**一次性预定义**。Phase 1 LLM 在写 script.yaml 时只能 **copy** story_spec 中的 flags 列表，不能增删改名。

**为什么不是方案 Y (Phase 1 自由命名)**：
- 违背状态机心智模型（transitions 应该 design-time 定义）
- 跨 script 命名漂移（同一个 skill 重新生成 script 后 flag 名可能变）
- 作者无法预设 ending 条件

**为什么不是方案 Z (作者 UI 手动填)**：
- 要求作者懂状态机思维，对非程序员作者 UX 代价太大
- 当前作者是"创意驱动"角色，把 state machine 设计交给 LLM 是合理分工
- 作者如果不满意可以重新跑 export agent
- 方案 Z 保留为未来想法（在 Open Questions 中注明）

**配套约束**：
- Phase 1 LLM 的 prompt 必须明确 "state_schema.flags 的 key 集合必须完全等于 story_spec.flags 列表（name 字段）"
- Phase -1 加载时验证 `script.state_schema.flags 集合 == story_spec.flags 集合`
- 不匹配时 standard flow：标 (损坏)

### Decision 4: 所有角色都必须含完整共享 axes

**选择**：每个角色在 `set_character_axes` 完成后，schema 中必须含 `affinity.<char>.bond` + `affinity.<char>.<axis_a>` + `affinity.<char>.<axis_b>` 三个字段。**没有 opt-out**。

**理由**：
- 跨角色聚合 DSL 依赖完整性：`all_chars: { axis: bond, op: ">=", value: 7 }` 不能因为某个角色没有 bond 而失败
- 统一性 > 灵活性：哪怕某个角色跟主角完全无接触，他也有 bond（可能初值很低）
- `shared_initial_overrides` 解决"这个角色初始就疏远"的表达需求（见 Decision 5）

**违反时**：
- Phase 1 LLM 自检失败 → 重写
- Phase -1 加载验证失败 → 标 (损坏)
- Lint 规则 `SHARED_AXES_COMPLETENESS` 抓 SKILL.md 模板里的示例是否完整

### Decision 5: 共享 axes initial 可 per-character 覆盖

**问题**：反派角色（如葛木）初始 bond 应该是 1-2，不是 default 5。如果 default 固定，要么全局调整（影响其他角色），要么反派 bond 一开始就和主角一样"友好"。

**解决**：`set_character_axes` 工具接受 `shared_initial_overrides` 字段，per-character 覆盖某个共享 axis 的初始值：

```typescript
setCharacterAxes({
  character_name: "葛木",
  specific_axes: [
    { name: "opposition", initial: 8, desc: "意识形态对抗" },
  ],
  shared_initial_overrides: {
    bond: 1,        // 反派初始就不亲密
    trust: 2,
    rivalry: 7,
  },
})
```

**Schema 层面**：每个 `affinity.<char>.<axis>` 字段都有独立的 `default`，可以不同于全局。Phase 1 LLM 写 initial_state 时 copy 这些 defaults。

### Decision 6: 特异 axes 数量 0-2 个（弹性）

**选择**：每个角色可以有 0、1 或 2 个特异 axes。不强制任何数量。

**理由**：
- 主角（如伊莉雅）可能需要 2 个特异 axis（`self_worth` + `despair`）
- 次要角色可能 0 个特异（只有共享 3 个）
- 1 个是常态（如凛的 `tsundere_level`）
- Hard cap 2 防止 state schema 膨胀

**上限来源**：每个角色总字段数 = 3 共享 + 0~2 特异 = 3-5 字段。5 角色 × 4-5 字段 + 8 flags ≈ 25-33 个 schema 字段，state.yaml 仍然可读。

### Decision 7: Endings DSL 新增 all_chars / any_char primitive

**选择**：在现有 DSL 上加两个新节点类型，不改旧语法。

```yaml
# 新增
all_chars:
  axis: bond
  op: ">="
  value: 7
  except?: [char_name1, char_name2]   # 可选，排除列表

any_char:
  axis: trust
  op: ">="
  value: 8
  except?: [char_name1]
```

**语义**：
- `all_chars` → 对所有角色（减去 except 列表），该字段的 `op value` 都成立
- `any_char` → 至少一个角色（减去 except 列表），该字段的 `op value` 成立
- `axis` 必须是**共享 axis 之一**（bond / story_axis_a / story_axis_b）—— 特异 axis 不能聚合（语义不统一）
- `value` 类型必须匹配 schema 中该 axis 的 type（int 字段必须是 number）

**评估算法**：
```
evaluate(all_chars_node, state, schema, characters):
  included = characters - node.except
  for char in included:
    key = `affinity.${char}.${node.axis}`
    if schema[key] is None: return false (不合规)
    current = state[key]
    if not apply_op(current, node.op, node.value): return false
  return true

evaluate(any_char_node, state, schema, characters):
  included = characters - node.except
  for char in included:
    key = `affinity.${char}.${node.axis}`
    if schema[key] is None: continue
    current = state[key]
    if apply_op(current, node.op, node.value): return true
  return false
```

**与现有 DSL 的组合**：`all_chars` 和 `any_char` 可以出现在 `all_of` / `any_of` / `not` 的子节点位置，实现复合条件：

```yaml
condition:
  all_of:
    - all_chars: { axis: bond, op: ">=", value: 6, except: [葛木] }
    - { key: "flags.truth_of_grail_revealed", op: "==", value: true }
```

**拒绝的替代**：
- `count / sum / avg` —— YAGNI，a/b 够用
- Filter language (SQL-like) —— 过度工程
- Per-character 显式列表 —— 当前 `all_of` 已经支持

### Decision 8: Export agent 工作流 5 步

```
Step 1: set_story_metadata
        genre / tone / constraints / acts_options / default_acts

Step 2: set_story_state                                  ★ NEW
        shared_axes_custom: 2 个故事级 axis 名 (不含 bond)
        flags: [{ name, desc, initial }, ...]

Step 3: add_character (每个角色一次)

Step 4: set_character_axes (每个角色一次)
        specific_axes: [0-2 个特异 axis]
        shared_initial_overrides?: { bond: ..., <axis_a>: ..., <axis_b>: ... }

Step 5: finalize_export
```

**工作流顺序的理由**：
- Step 2 必须在 Step 3/4 之前 —— 角色的 axes 需要引用 story-level shared axes 命名
- `set_story_state` 是 `set_story_metadata` 的自然延伸，同属"故事整体设计"阶段
- Step 4 的 `shared_initial_overrides` 可选，但需要引用 Step 2 定义的 axis 名字

**Error 恢复**：每个工具的 input 校验失败返回 `{ error: ... }`，LLM 根据错误修正重试（沿用现有机制）。特别地：
- `set_character_axes` 在 `set_story_state` 之前调用 → 报错 "call set_story_state first"
- `set_character_axes.shared_initial_overrides` 引用了 story state 中不存在的 axis → 报错 "unknown shared axis: <name>"

### Decision 9: Phase -1 验证新增 2 项，共 6 重

在 `state-schema-edit-stable` 已有的 4 重验证之上：

```
验证 5: 共享 axes 完整性
─────────────────────────
从 state_schema 中提取所有 affinity.<char>.<axis> 字段
验证每个角色都有 bond + 2 个 story-defined 共享 axes（共 3 个）
缺失 → 标 (损坏)，提供删除入口

验证 6: Flags 集合一致性
─────────────────────────
从 state_schema 中提取所有 flags.<name> 字段的 key 集合
Read story_spec.md 的 flags 列表
两个集合必须**严格相等**（缺一不可、多一不可）
不匹配 → 标 (损坏)，提供删除入口
```

**实现方式**：纯 SKILL.md prompt 指令，LLM 在加载 script 前按步骤执行（沿用 state-schema-edit-stable 的风格）。

### Decision 10: 旧 skill 不向后兼容

**策略**：沿用 state-schema-edit-stable 的 hard fail 策略。

- 旧 skill（SKILL.md 模板没有 story_state 段）运行时继续按旧规则跑，不受影响
- 用旧 skill 生成的 script 被新 SKILL.md 加载时 → 验证 5/6 失败 → 标 (legacy) → 只能删除
- 跨版本存档不迁移

**理由**：
- 早期项目，累计 skill 数量少
- 向后兼容会让 Phase -1 加载流程多一个 legacy 分支，复杂度上升
- 用户已在之前的 change 接受过这种策略

## Risks / Trade-offs

**[Risk] Export agent LLM 设计 flags 时遗漏关键节点** → Phase 1 LLM 发现想引用的 flag 不存在时，只能在写 scenes 时回避或降级。缓解方式：set_story_state 的 prompt 引导 LLM 先列出"这个故事最可能的 3-5 个 ending 条件"，再从中反推需要的 flags。作者可重跑 export。

**[Risk] 共享 axes 完整性强制约束让 Phase 1 LLM 每次都要写 3N 个 affinity 字段** → 对 5 角色故事是 15 个 affinity 字段 + 8 flags ≈ 23 行 schema。可接受。LLM 遵循度由 Phase 1 自检 + Phase -1 验证 + Lint 三层保障。

**[Risk] 故事级 shared_axes_custom 命名与 LLM 自由发挥冲突** → LLM 可能想给某个角色一个"专属 trust"而非共享 trust。缓解：prompt 明确"共享 axes 是跨角色聚合基准，语义要通用；角色特异情感用特异 axes 表达"。

**[Risk] all_chars except 字段的语义在多角色场景下易用错** → 作者可能忘了某个反派应该在 except 列表里。缓解：文档 + lint 最佳实践提示。不做硬约束。

**[Trade-off] 工作流从 4 步变 5 步** → Export agent 要多做 1 次工具调用。对大 LLM（Claude/GPT）代价低；对小 LLM（GLM-5）可能增加卡顿概率。沿用 state-schema-edit-stable 对"LLM 容量"的假设。

**[Trade-off] 每个角色必须完整 3 个共享 axes** → 某些次要角色可能实际不需要 bond（如旁白角色）。但强制完整让聚合 DSL 简洁。可通过 initial = 0 + 永不变化的设计表达"此角色不参与亲密度系统"。

**[Trade-off] Flags soft cap 8 个** → 某些复杂故事可能需要更多。但 8 个已经能覆盖大多数主线分支。硬需要时作者可在 prompt 里明确要求 LLM 生成更多，soft cap 不阻塞。

**[Trade-off] 特异 axis 只允许引用在 ending condition，不能跨角色聚合** → 符合语义（特异 axis 本来就不统一）。如果未来想做 "伊莉雅 self_worth + 凛 understanding ≥ 15" 这种跨角色特异轴求和，是单独的 change。

## Migration Plan

无运行时数据迁移。旧 skill 与新 skill 共存，新 skill 用新规则，旧 skill 用旧规则。

实现顺序：

1. **数据层** — `StoryMetadata` / `StorySpecConfig` interface 扩展，`StoryState` 新 interface，`CharacterAxis` 语义调整
2. **Export agent 数据层** — `ExportBuilder` 加 `setStoryState` 方法 + 完整性校验
3. **Export agent tool 层** — 新增 `set_story_state` tool，更新 tool 描述与 zod schema
4. **Export agent prompt 层** — system prompt 工作流从 4 步改 5 步；加入 story_state 设计指引段
5. **story-spec.md 模板** — 状态系统章节重写为三层结构；结局判定章节加 all_chars/any_char 说明
6. **SKILL.md 模板** — `buildStateSchemaSection` 重写；`buildEndingsDslSection` 新增 primitive 描述；`buildPhaseMinusOne` 加验证 5/6
7. **Lint** — 新增 `SHARED_AXES_COMPLETENESS` 规则
8. **测试** — 单测覆盖：StoryState 序列化、set_story_state tool、共享 axes 完整性检查、all_chars/any_char DSL 评估
9. **E2E** — 用 fsn 案例验证 Phase 1 LLM 产出合规 schema，Phase -1 加载通过 6 重验证

每一步都向前兼容上一步（tool 层不依赖 template，template 不依赖 lint），可以分批 PR。

## Open Questions

- **作者 UI 手动填 flags 的选项**：当前决定用 export agent LLM 预定义（方案 X），不做 UI 手动填（方案 Z）。如果 LLM 反复漏掉关键 flag 导致作者需要频繁重跑 export，可能将来要补 UI。留为未来想法。
- **跨 story 的 shared_axes 一致性**：当前每个故事可以自由定义 2 个非 bond 的共享 axis，跨故事不一致。如果将来想做"soulkiller 平台级的 shared axes 建议集合"（比如推荐 trust/respect/alignment），可以作为 UI 辅助选择器，但不作为硬约束。
- **flag transition 规则**：当前 flags 是自由触发（任何 scene 的 consequences 都可以把任意 flag 设为 true）。如果将来想做"flag B 只能在 flag A 触发之后才能触发"这种 transition 约束，需要 DSL 扩展，不在本 change 范围。
- **特异 axes 的聚合**：当前 all_chars/any_char 只支持共享 axes。如果作者想写 "所有角色的特异 axis 总和 ≥ 10" 这种条件，现在做不到。故意留白，等真实需求再扩展。
- **初始值偏差过大的自动检测**：共享 axes 默认都是 5，作者覆盖后如果差距过大（比如某角色初始 bond = 10 另一个 = 0）可能让 ending 条件失衡。可以由 lint 给 warning，但第一版不做。
- **per-character shared axis initial override 的 serializer**：`shared_initial_overrides` 在 story-spec.md 里怎么表达？一种方式是每个角色的 axes 列表里显式列出 `bond: X` 的 override；另一种方式是 story-spec 层面记录 override 表。需要在实现时决定（倾向前者，跟现有 CharacterAxis 结构更自然）。
