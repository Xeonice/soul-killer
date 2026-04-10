## Context

Export agent 的 tool-loop 由 vercel AI SDK 的 `ToolLoopAgent` 驱动，`stopWhen` 配置决定何时终止。当前配置是：

```typescript
stopWhen: [stepCountIs(20), hasToolCall('finalize_export')]
```

两个终止条件是 OR 关系：任何一个触发就停。`hasToolCall('finalize_export')` 是"**成功**终止"，`stepCountIs(20)` 是"**死循环护栏**"。

问题是这个"护栏" 20 步是跟历史工作流步数紧耦合的。工作流从 4 步扩展到 6 步，角色数上限从 4 取消到无限，都没同步审视这个魔法数字。在 9 角色 skill 上，22 步的最小需求撞上 20 步护栏，导致 mathematical guaranteed failure。

从用户截图诊断出具体卡点：
```
  1. set_story_metadata          ✓
  2. set_story_state             ✓
  3. set_prose_style             ✓
  4-5.  关羽 add + axes          ✓
  6-7.  曹操 add + axes          ✓
  8-9.  刘备 add + axes          ✓
  10-11. 张飞 add + axes         ✓
  12-13. 诸葛亮 add + axes       ✓
  14-15. 赵云 add + axes         ✓  ← 刚完成 6/9 角色
  ... LLM 可能还夹一些 "思考" 步 ...
  20.                             → stopWhen 触发，未跑完
```

错误消息只说 "已执行 20 步"，用户需要自己发现 20 是硬上限、是护栏而非预算，这是 UX bug。

## Goals / Non-Goals

**Goals:**

- 让 step cap 随角色数动态扩展，不再是固定魔法数字
- 对任何合理角色数（1-20+）都留出足够缓冲，让正常流程不会撞上限
- 把公式定义为可读的命名常量 + 辅助函数，让以后加新工具时能看到 baseline 公式，避免重蹈覆辙
- 当 agent 因 step cap 耗尽而非正常终止时，错误消息明确提示 "达到 step 上限"，帮用户诊断

**Non-Goals:**

- **不**换掉 `stepCountIs` 机制本身。这是 vercel AI SDK 提供的 OR 终止条件，用动态值传入就够，不需要自己实现 loop controller
- **不**加运行时"接近上限"预警。UX 复杂度不值得 —— 新公式下正常流程根本不会接近上限
- **不**做跨 agent 的通用 step cap 计算（soul-capture-agent、world-capture-agent 等）。它们的工作流结构不同，各自 own
- **不**引入 retry 机制。达到 cap 仍然是错误，只是错误消息更清晰

## Decisions

### Decision 1: 公式 `minimalSteps + safetyBuffer`

```
  minimalSteps = 3 + N × 2 + 1 = 2N + 4
  safetyBuffer = max(5, N)
  step_cap     = minimalSteps + safetyBuffer
```

**对几个常见规模**：

| N 角色 | minimalSteps | safetyBuffer | step_cap |
|---|---|---|---|
| 1 | 6 | 5 | **11** |
| 2 | 8 | 5 | **13** |
| 4 | 12 | 5 | **17** |
| 6 | 16 | 6 | **22** |
| 9 | 22 | 9 | **31** |
| 12 | 28 | 12 | **40** |
| 20 | 44 | 20 | **64** |

理由：

- `minimalSteps` 是精确计算，保证任何角色数都有足够步数完成正常流程
- `safetyBuffer = max(5, N)` 给 LLM 偶尔的"思考重试"余量。小 skill（N ≤ 5）固定 5 步 buffer；大 skill（N > 5）buffer 随规模线性扩张，因为大 skill 的 LLM 更容易在中间 retry / 重读
- 不用固定大值（比如 50）：对 2 角色 skill，50 是 6× 正常需求，LLM 如果出问题 would loop 50 次才终止，浪费 token

### Decision 2: baseline 步数是常量，不是推断值

```typescript
/**
 * Minimum setup tool calls before character registration begins:
 * - set_story_metadata (1)
 * - set_story_state    (2)
 * - set_prose_style    (3)
 */
const STEP_SETUP_BASELINE = 3

/**
 * Minimum closing tool calls after all characters registered:
 * - finalize_export    (1)
 */
const STEP_FINALIZE = 1

/**
 * Per-character tool calls:
 * - add_character      (1)
 * - set_character_axes (2)
 */
const STEP_PER_CHARACTER = 2
```

**选命名常量而不是推断**。理由：

- 这三个数字是"合同"：反映了当前工作流的精确结构。以后任何 change 加一个 setup tool 就必须更新这个常量，形成 spec-level 审视点
- 推断（从 tool 定义里自动计算）太脆：LLM 会调用非必需的工具吗？会重复调用吗？自动推断会误判
- 常量 + 辅助函数便于单测

### Decision 3: 错误消息区分 step-cap 终止 vs 其他终止

`stopWhen: [stepCountIs(cap), hasToolCall('finalize_export')]` 达到任一条件就停。当前代码后续检查"finalize 是否被调用"来判断成功 / 失败，但失败消息不区分原因。

新逻辑：在失败分支里检查 `actualStepsUsed`。如果 `actualStepsUsed >= stepCap`，错误消息明确说"达到 step 上限"；否则保留原消息（LLM 自愿停止的其他原因，比如 context 炸了）。

```
  if (!finalizeCalled):
    if (actualStepsUsed >= stepCap):
      error = `导出代理达到 step 上限（${stepCap} 步，${characterCount} 角色）。已注册 ${registered}/${characterCount} 个角色。`
    else:
      error = `导出代理未调用 finalize_export，已执行 ${actualStepsUsed} 步。`
```

### Decision 4: 单测位置

- 新建 `tests/unit/export-step-cap.test.ts`，专门测 `computeExportStepCap` 公式
- 不加到 `export-builder.test.ts` 因为 step cap 跟 builder 逻辑正交
- 不做端到端 integration test（涉及真实 LLM，太重）—— 这个 fix 是纯数学公式，单测足够

## Risks / Trade-offs

| Risk | Mitigation |
|---|---|
| 公式对某些边缘情况不够：比如 LLM 在某次 add_character 后因为 validation error 需要 retry 3 次，吃掉 buffer | `safetyBuffer = max(5, N)` 的 N 部分对大 skill 扩展；对小 skill 的固定 5 也能容纳 2-3 次 retry。极端情况下，达到 cap 仍然会停 — 但错误消息明确告诉用户"达到上限"，用户知道问题在 retry 过多而不是 cap 设置 |
| 用户手动设置一个"无理由巨大" N（比如 50 角色），step_cap 会变成 154，LLM 真的在死循环时浪费 token | 50+ 角色本身不现实；1M context 也装不下 50 个角色的全部数据。实际 N 上限是用户的 context budget，不是 step cap |
| 改错 baseline 常量（比如忘了算 set_prose_style）导致小 skill 失败 | 单测覆盖常量值 + minimalSteps 公式；改常量的 PR 必须同步改测试 |
| 未来工作流加新工具但忘记更新 baseline 常量 | 常量定义上方的 JSDoc 明确列出每个步骤对应的 tool 名。Agent 工作流的 spec 定义在 cloud-skill-format / export-agent 两个 spec 里，新工具必须同步这两个地方之一，reviewer 会看到 |

## Open Questions

- `safetyBuffer` 用 `max(5, N)` 还是 `max(5, N × 1.5)`？倾向前者（更克制），实测出问题再调
- 要不要在 progress panel 上显示 "step X/Y"？可选增强，不属于本 change
