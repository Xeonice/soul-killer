## Context

Export agent 当前是单 LLM 循环：拿到 soul/world 数据后直接按 Step 1-5 调用工具（set_story_metadata → set_story_state → set_prose_style → add_character × N → set_character_axes × N → finalize_export）。没有规划阶段，LLM 直接边想边做。

已观察到的故障：6 角色导出中 LLM 漏掉了間桐桜的 `set_character_axes`，`finalize_export` 校验失败后因 `hasToolCall('finalize_export')` 的 stopWhen 条件立即终止，无法重试。用户在 300 秒的"思考中"后才意识到出了问题。

## Goals / Non-Goals

**Goals:**
- 将 export agent 拆分为 Planning Agent + Execution Agent 双循环
- Planning Agent 输出结构化薄 plan（方向性决策），程序校验完整性
- 两个循环之间暂停展示 plan 详情，用户确认后再执行
- 修复 `finalize_export` 的 stopWhen bug，允许失败后重试
- UI 展示双阶段进度，执行阶段按角色分组

**Non-Goals:**
- 厚 plan（Planning Agent 不输出完整的工具参数，只输出方向）
- 代码执行器替代 Execution Agent（Execution Agent 仍然是 LLM 循环）
- Plan 编辑功能（用户不满意只能取消重来，不能在 UI 里修改 plan）
- 改变 Execution Agent 的现有工具集（set_story_metadata 等工具不变）

## Decisions

### Decision 1: 薄 plan 而非厚 plan

Planning Agent 输出方向性决策（genre_direction、tone_direction、role 分配、轴方向描述），Execution Agent 负责细化为具体参数。

**为什么不用厚 plan：** 如果 plan 包含所有工具参数的精确值，Planning Agent 实质上做了 Execution Agent 的全部工作，拆成两个循环反而是浪费。薄 plan 让两个 agent 各有明确职责 — 战略 vs 战术。

### Decision 2: Plan 确认在两个循环之间（代码层），不在 Planning Agent 循环内

Planning Agent 的唯一工具是 `submit_plan`，调用后 agent 立即终止。确认交互由 `runExportAgent` 函数在两个循环之间的代码层处理。

**为什么不在 Planning Agent 里用 ask_user：**
- Planning Agent 职责干净 — 只做规划
- 确认逻辑在代码层，确定性 100%（不依赖 LLM 记得调 ask_user）
- 用户取消时不需要处理"agent 还在跑"的问题

### Decision 3: Execution Agent 仍然接收 soul/world 全文

薄 plan 只有方向，Execution Agent 需要原始资料来：
- 细化 prose_style 的 forbidden_patterns（需要读 style.md）
- 写 dynamics_note（需要读 relationships.md）
- 判断 voice_summary 内容（需要读 style.md）

代价是 token 翻倍（两个 agent 都吃全文），但这是薄 plan 的固有代价，换取了 Execution Agent 的创意能力。

### Decision 4: `submit_plan` 的 plan schema

```typescript
interface ExportPlan {
  genre_direction: string          // 类型大方向，如 "魔术战争 / 心理剧"
  tone_direction: string           // 基调大方向
  shared_axes: [string, string]    // 2 个非 bond 共享轴名（snake_case）
  flags: string[]                  // 关键事件 flag 名列表（snake_case）
  prose_direction: string          // 叙事风格方向描述
  characters: ExportPlanCharacter[]
}

interface ExportPlanCharacter {
  name: string                     // 精确匹配 preSelectedSouls
  role: 'protagonist' | 'deuteragonist' | 'antagonist'
  specific_axes_direction: string[] // 0-2 个特异轴的方向描述（自然语言）
  needs_voice_summary: boolean
  appears_from?: number            // 从第几幕出场（可选）
  shared_initial_overrides_hint?: Record<string, number>  // 初始值偏离提示
}
```

**薄的边界**：flags 只传名称列表（snake_case），desc 和 initial 由 Execution Agent 补充。specific_axes 只传方向描述（自然语言），range/default 由 Execution Agent 决定。

### Decision 5: `submit_plan` 的程序校验

校验项（失败返回 `{ error }`，LLM 可修正重试）：
1. `characters` 覆盖所有 `preSelectedSouls`（不多不少）
2. `shared_axes` 恰好 2 个，均为 snake_case
3. 至少 1 个 character 的 role 为 `protagonist`
4. 每个 character.name 在 preSelectedSouls 中存在
5. `flags` 非空，均为 snake_case
6. `genre_direction` 和 `tone_direction` 非空

### Decision 6: Plan 确认 UI — plan_review ActiveZone

新增 `plan_review` ActiveZone 类型：

```typescript
| { type: 'plan_review'; plan: ExportPlanSummary }
```

渲染为角色编排表 + 故事方向摘要。交互：Enter 继续、Esc 取消。不可编辑。

### Decision 7: 修复 finalize_export stopWhen

```typescript
// Before (bug)
stopWhen: [stepCountIs(stepCap), hasToolCall('finalize_export')]

// After
let finalizeSucceeded = false
stopWhen: [stepCountIs(stepCap), () => finalizeSucceeded]
```

`finalize_export` 的 execute 在成功时设 `finalizeSucceeded = true`。失败时返回 `{ error }` 但 flag 保持 false，agent 继续。

### Decision 8: 双阶段的 step cap

Planning Agent 的 step cap：固定 5（1 次 submit_plan + 4 次重试缓冲）。

Execution Agent 的 step cap：沿用现有 `computeExportStepCap(characterCount)` 公式不变。finalize_export 可重试消耗的额外步数由 safetyBuffer 覆盖。

### Decision 9: ExportPhase 扩展

```typescript
// Before
type ExportPhase = 'initiating' | 'selecting' | 'analyzing' | 'configuring' | 'packaging' | 'complete' | 'error'

// After — 新增 planning 和 plan_review
type ExportPhase = 'initiating' | 'planning' | 'plan_review' | 'selecting' | 'analyzing' | 'configuring' | 'packaging' | 'complete' | 'error'
```

### Decision 10: 执行阶段 trail 按角色分组

不再逐工具调用展示 trail，而是：
- 3 行 setup（metadata / state / prose）— 各自独立
- N 行 per-character — 每个角色一行，合并 add_character + set_character_axes 的结果
- 1 行 finalize

角色分组通过在 `reducePanelEvent` 中跟踪"当前角色"状态实现：当 `tool_start` 的 tool 为 `add_character` 时开始新的角色组，后续的 `set_character_axes` 合并到同一组。

### Decision 11: 双阶段分隔线

UI 用 `── 规划 ──` 和 `── 执行 ──` 文本分隔线区分两个阶段。分隔线在 `phase` 切换时渲染，不占 trail 空间。

## Risks / Trade-offs

- **[Token 翻倍]** 两个 agent 都吃 soul/world 全文 → 薄 plan 的固有代价。如果 token 成本成为问题，未来可以让 Planning Agent 只接收 identity.md + relationships.md 的摘要（精简输入），但这是后续优化。
- **[延迟增加]** 多一轮 LLM 调用 + 用户确认交互 → 总时间增加约 30-60 秒。但换来了用户预览和防漏的价值。
- **[Plan-Execution 漂移]** Execution Agent 可能偏离 plan 方向（plan 说 protagonist 但 agent 改成了 deuteragonist）→ 可以在 Execution Agent 的工具校验中 cross-check plan，但本次不做硬约束，只在 system prompt 里强调"按 plan 执行"。
- **[Planning Agent 失败]** LLM 反复提交不合格 plan → step cap 5 步用尽后直接报错给用户，不进入执行阶段。
