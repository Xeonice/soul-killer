## Context

Execution Agent 当前是单 ToolLoopAgent（18 步 for 7 chars），context 累积到 ~90K tokens 后 glm-5-turbo 退化。Planning Agent 已经拆分为 3 个小工具成功解决了类似问题。现在对 Execution 做同样的拆分。

## Goals / Non-Goals

**Goals:**
- 将 Execution 阶段拆为 Story Setup Agent + Character Loop + Finalize 三个独立阶段
- 每个阶段的 context 独立且小，消除累积膨胀
- Character Loop 逐角色独立调用，每轮只传该角色的数据
- 保持 builder 实例共享、UI 进度事件兼容

**Non-Goals:**
- 不改 Planning Agent（已拆分完毕）
- 不改 ExportBuilder 或 ExportProtocolPanel
- 不做二级拆分（generateObject 替代 ToolLoopAgent）— 一级拆分后观察效果

## Decisions

### Decision 1: 三阶段拆分

```
runExportAgent() {
  plan = await runPlanningLoop(...)        // 已有
  confirmed = await waitForPlanConfirm()   // 已有
  
  // ─── Execution 三阶段 ───
  await runStorySetup(model, plan, builder, ...)    // 新：3 步
  await runCharacterLoop(model, plan, builder, ...) // 新：N × 2 步
  finalizeAndPackage(builder, preSelected, ...)      // 新：纯代码
}
```

### Decision 2: Story Setup Agent

独立 ToolLoopAgent，工具集只有 `set_story_metadata` + `set_story_state` + `set_prose_style` + `ask_user`。

initial prompt：plan JSON + world manifest + world entries + 所有角色的 style.md（prose_style 需要判断非中文占比）。不需要 identity/milestones/behaviors。

system prompt：精简版 EXECUTION_SYSTEM_PROMPT 的 §1-3.5 部分（story-level 指引），去掉 §4-6（角色相关）。

step cap：固定 8（3 正常步 + 5 重试缓冲）。

### Decision 3: Character Loop

不是一个大 ToolLoopAgent，而是 **N 次独立的短 ToolLoopAgent 调用**，每次只处理一个角色。

每轮的 ToolLoopAgent：
- 工具集：`add_character` + `set_character_axes`（只有 2 个）
- initial prompt：plan 中该角色的方向 + 该角色的完整 soul data（identity/style/capabilities/milestones/behaviors）
- system prompt：精简版，只包含 §4-5（角色注册 + 轴设置）指引
- step cap：固定 5（2 正常步 + 3 重试缓冲）

每轮的 context 只有 ~5-15K tokens（1 个角色的数据），远小于当前的 ~90K。

builder 是同一个实例，逐角色累积。

### Decision 4: Finalize 阶段

纯代码，不需要 LLM：
1. `builder.build()` — 校验完整性，组装 story_spec
2. 注入 storyName / storyDirection
3. `packageSkill()` — 打包 .skill 文件
4. 发送 complete 进度事件

从原来的 `finalize_export` tool 的 execute 逻辑提取为独立函数。

### Decision 5: 进度事件兼容

三个阶段都通过同一个 `onProgress` 回调发送事件，格式不变。ExportProtocolPanel 不需要知道内部拆分。Phase 保持 `analyzing` → `packaging` → `complete` 的顺序。

### Decision 6: 错误处理

- Story Setup 失败 → 直接报错，不进入 Character Loop
- Character Loop 某个角色失败 → 直接报错，不继续后续角色
- Finalize 失败 → 报错（和当前 finalize_export 一样）
- 熔断器逻辑移到每个子 agent 里

### Decision 7: watchdog 和熔断器

每个子 agent 独立的 watchdog（90s）和熔断器（连续 3 次同工具错误）。不在子 agent 间共享。

## Risks / Trade-offs

- **[跨步骤一致性]** Story Setup Agent 不知道 Character Loop 的结果，反之亦然 → plan 作为统一的 ground truth 保证一致性
- **[延迟增加]** N 个独立 LLM 调用 vs 1 个大 loop → 可能稍慢（多次 API 调用开销），但每次调用更快（context 小）
- **[代码量增加]** 从 1 个大函数变成 3-4 个小函数 → 可通过共享 stream-loop 辅助函数减少重复
