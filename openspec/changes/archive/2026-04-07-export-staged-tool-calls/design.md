## Context

上一轮 `export-user-driven-selection` 的实测暴露出 `package_skill` 的根本问题：它要求 LLM 一次性生成 ~1000 tokens 的嵌套结构化 JSON。这违反了 LLM 的核心能力曲线——LLM 擅长**多步对话式推理**，不擅长**一次性大输出**，尤其是结构化的。

我们已经加了 `z.preprocess` 来兼容 glm-5 把 input 当字符串发的怪异行为，但那只是治标。本 change 治本：拆分工具，让每次 input 都很小。

## Goals / Non-Goals

**Goals:**
- 把 `package_skill` 拆成多个小工具，每个 input ≤ 200 tokens
- 工具调用顺序自然反映 agent 的决策流（先 metadata，再 per-character）
- 每个工具调用都有明确的结果反馈（ok / error）
- 用户能从 trail 看到每个角色的添加进度
- 保持下游 packager API 不变

**Non-Goals:**
- 不改 packageSkill 的函数签名或内部逻辑
- 不改 StorySpecConfig 或 SKILL.md 模板
- 不改 user-driven selection 的流程（souls/world 选择仍走 UI）
- 不引入持久化的 builder 状态（仅 agent 运行期间内存）

## Decisions

### D1: 4 个分阶段工具

```typescript
set_story_metadata({
  genre: string
  tone: string
  constraints: string[]
  acts_options: [
    { acts: number, label_zh: string, rounds_total: string, endings_count: number }
  ]    // 2-3 个幕数预设
  default_acts: number  // acts_options 中某项的 acts 值
})
→ { ok: true, summary: "Metadata saved: 3 length options (default 5 acts)" }

add_character({
  name: string         // 必须匹配 preSelected.souls 中的某项
  role: 'protagonist' | 'deuteragonist' | 'antagonist' | 'supporting'
  display_name?: string
  appears_from?: string  // 默认 "act_1"
  dynamics_note?: string
})
→ { ok: true, summary: "Character 1/4 added: 远坂凛 (protagonist)" }

set_character_axes({
  character_name: string  // 必须先通过 add_character 添加
  axes: [
    { name: string, english: string, initial: number }
  ]  // 长度 2-3
})
→ { ok: true, summary: "Axes set for 远坂凛: 信任/理解/羁绊" }

finalize_export({
  output_dir?: string
})
→ { output_dir, files, skill_dir_name, soul_count }
```

**理由**:
- 每个 input < 200 tokens，LLM 不会发成字符串字面量
- 4 角色场景：1 + 4 + 4 + 1 = 10 步，每步 1-3 秒 → 总耗时和现状相当但分散，UI 持续推进
- 错误隔离：`add_character('远坂凛')` 失败不影响其他角色

### D2: ExportBuilder 累积器

```typescript
class ExportBuilder {
  metadata?: StoryMetadata
  characters: Map<string, CharacterDraft> = new Map()  // name → draft

  setMetadata(m: StoryMetadata) { this.metadata = m }

  addCharacter(c: CharacterDraft) {
    if (this.characters.has(c.name)) {
      throw new Error(`Character '${c.name}' already added`)
    }
    if (!this.preSelectedSouls.includes(c.name)) {
      throw new Error(`'${c.name}' not in pre-selected souls`)
    }
    this.characters.set(c.name, c)
  }

  setAxes(name: string, axes: Axis[]) {
    const char = this.characters.get(name)
    if (!char) throw new Error(`Character '${name}' not added yet`)
    if (axes.length < 2 || axes.length > 3) throw new Error('axes 必须 2-3 个')
    char.axes = axes
  }

  build(): { souls: string[]; world_name: string; story_spec: StorySpecConfig } {
    if (!this.metadata) throw new Error('缺少 set_story_metadata')
    if (this.characters.size === 0) throw new Error('至少需要 add_character 一次')

    const charactersList = Array.from(this.characters.values())
    const incomplete = charactersList.find((c) => !c.axes)
    if (incomplete) throw new Error(`角色 '${incomplete.name}' 缺少 set_character_axes`)

    return { ...this.metadata, characters: charactersList, ... }
  }
}
```

**理由**: 单一可信状态源；finalize 时一次性验证完整性。

### D3: 工具的错误反馈是 return value，不是 throw

**决策**: execute 函数捕获所有内部错误，**返回** `{ error: "..." }` 而不是 throw。

**理由**: throw 在 AI SDK v6 流式 tool 中可能导致整个 stream 异常退出。返回错误结构让 agent 在下一步看到失败、修正后重试。

```typescript
add_character: tool({
  ...
  execute: async (input) => {
    try {
      builder.addCharacter(input)
      return {
        ok: true,
        summary: `Character ${builder.characters.size}/${preSelected.souls.length} added: ${input.name} (${input.role})`,
      }
    } catch (err) {
      return { error: err instanceof Error ? err.message : String(err) }
    }
  },
})
```

### D4: stopWhen 改用 finalize_export

```typescript
stopWhen: [
  stepCountIs(20),  // 4 角色 × 2 + metadata + finalize ≈ 10 步，预算 20 步
  hasToolCall('finalize_export'),
]
```

`finalize_export` 内部调用 `packageSkill` 并发出 `complete` 事件。

### D5: System prompt 引导分阶段调用

```
工作流（必须按此顺序）：

1. 调用 set_story_metadata 设定故事整体框架
2. 对每个角色（顺序自由）：
   a. 调用 add_character 注册角色
   b. 调用 set_character_axes 设置该角色的好感轴
3. 所有角色都完成后，调用 finalize_export 触发打包

注意：
- add_character 必须在 set_character_axes 之前
- 同一个角色不要重复 add_character
- 每次调用 input 简短即可，不要在一次调用里塞所有信息
- 如果某次调用返回 error，根据错误信息修正后重试
```

### D6: 保留 ask_user 兜底

`ask_user` 工具不变，仍作为兜底（数据严重不足时使用）。

### D7: Trail 展示适配

每个 tool 调用都有简短 summary（如 "Character 1/4 added: 远坂凛"），UI 的 trail 自然形成进度感。无需改 panel，复用现有的 tool_end 展示即可。

### D8: 幕数从硬决策变为运行时选项

**决策**: agent 不再决定固定的 `acts: 4`，而是提供 2-3 个预设选项，由 SKILL.md 引擎在 Phase 0 让用户选择。

**新数据结构**:
```typescript
interface ActOption {
  acts: number          // 幕数
  label_zh: string      // "短篇" / "中篇" / "长篇"
  rounds_total: string  // "24-36" 等
  endings_count: number // 该长度对应的结局数
}

interface StorySpecConfig {
  // ... 其他字段不变
  acts_options: ActOption[]  // 之前是 acts: number
  default_acts: number        // 之前是 endings_min / rounds 单值
  // 移除: acts, endings_min, rounds
}
```

**Agent 推荐规则**:
- 角色数 ≤ 2 → 推荐 `[3, 5]`，default 3
- 角色数 3-4 → 推荐 `[3, 5, 7]`，default 5

**SKILL.md 引擎 Phase 0 流程**:
```
1. 显示故事介绍（genre + tone）
2. 显示幕数选项:
   ▸ 短篇 (3 幕，24-36 轮，4 结局)
   ▸ 中篇 (5 幕，40-60 轮，5 结局) [推荐]
   ▸ 长篇 (7 幕，56-84 轮，6 结局)
3. 用户选择
4. 引擎记录: state.chosen_acts, state.rounds_budget, state.endings_count
5. 进入 Phase 1 (Act 1)
```

**理由**:
- 同一组角色可以演短篇也可以演长篇
- 用户主动控制游戏时长，而不是 export 时被锁定
- agent 仍负责"什么时长合理"的判断（推荐选项），但不剥夺用户选择权
- `appears_from: act_5` 在用户选了短篇 (3 幕) 时如何处理？引擎策略：超出总幕数的角色推迟到最后一幕首次出场，或者按比例缩放（默认按比例）

**替代方案**: 
- 完全自由 (1-10 幕) → 用户决策成本高
- 单一推荐 + 跳过此设计 → 失去 runtime 灵活性
- 在 set_story_metadata 之后单独 set_length_options → 步数增加，且关联性强不应分开

### D9: appears_from 与可变 acts 的适配

**决策**: appears_from 的语义从"绝对幕号"变为"相对位置"。

```
appears_from: "act_1"  → 第一幕（始终最早出场）
appears_from: "act_2"  → 第二幕开始（短篇也是第二幕）
appears_from: "act_3"  → 第三幕开始
```

但如果用户选了 3 幕短篇而某角色 `appears_from: act_5`，引擎策略：
1. 出场幕 ≤ 总幕数 → 直接使用
2. 出场幕 > 总幕数 → 截断到 `act_<总幕数>`，即最后一幕首次出场

简单且 robust，不需要 agent 关心。

**理由**: agent 写 spec 时不知道用户会选什么长度，只能写一个值。引擎在运行时做截断比让 agent 写一个矩阵简单得多。

## Risks / Trade-offs

- **[Risk] 步数预算超支** → 4 角色需要 10 步，预算 20 充足；6+ 角色场景需要观察。如果未来支持 8+ 角色，调高 stepCountIs 即可
- **[Risk] Agent 不按顺序调用** → 通过 builder 状态校验在 setAxes 时返回 error，让 agent 自己修正
- **[Risk] Builder 状态泄漏** → builder 是函数局部变量，agent 结束自动 GC
- **[Risk] StorySpecConfig 类型变更影响下游** → packager.ts 和 skill-template.ts 必须同步更新；旧 story-spec.md 文件不兼容（但旧 export 是单角色简单结构，影响小）
- **[Risk] SKILL.md 引擎复杂度上升** → Phase 0 增加幕数选择 + rounds budget 动态计算；通过 template 抽象降低复杂度
- **[Trade-off] 单调用 vs 多调用** → 多调用总耗时和单调用相当，但每步快、用户感知好、错误粒度细
- **[Trade-off] System prompt 变长** → 增加几行说明分阶段工作流和 acts_options 推荐规则，整体仍在合理范围内
- **[Trade-off] 幕数 runtime 选择 vs export 时固定** → 灵活性 +1，但需要用户在 skill 启动时多按一次键。值得
