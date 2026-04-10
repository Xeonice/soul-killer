## Why

Execution Agent 当前是一个单 ToolLoopAgent 循环，7 个角色需要 18 步工具调用。随着 tool call/result 历史累积，context 从 ~50K 膨胀到 ~90K tokens，glm-5-turbo 在后期步骤退化（发送空参数、丢失工具格式），导致无限错误循环直到 step cap 或熔断器触发。

将 Execution Agent 拆分为 3 个短循环，每个循环的 context 独立且小，消除累积膨胀导致的模型退化。

## What Changes

- **Story Setup Agent**：独立循环，3 步（set_story_metadata → set_story_state → set_prose_style），接收 plan + world data + 所有角色的 style.md（prose 需要）
- **Character Loop**：逐角色循环，每轮 2 步（add_character → set_character_axes），每轮只接收 plan 中该角色的方向 + 该角色的 soul data，context 极小且不跨角色累积
- **Finalize**：纯代码调用 `builder.build()` + `packageSkill()`，零 LLM 调用
- 原有的 `runExportAgent` 编排三个阶段顺序执行，builder 实例在三个阶段间共享
- UI 进度事件保持兼容，ExportProtocolPanel 无需改动

## Capabilities

### New Capabilities
- `execution-story-setup`: Story Setup Agent 循环 — 3 个 story-level 工具调用的独立 ToolLoopAgent
- `execution-character-loop`: Character Loop — 逐角色独立 ToolLoopAgent 循环

### Modified Capabilities
- `export-agent`: runExportAgent 的 Execution 阶段从单循环改为 Story Setup → Character Loop → Finalize 三阶段

## Impact

- `src/agent/export-agent.ts` — 主要改动：拆分 Execution 阶段为 3 个函数
- builder 实例在 3 个阶段间共享（已有设计，无需改动 ExportBuilder）
- ExportProtocolPanel 无需改动 — 进度事件格式不变
- step cap 需要分别计算（Story Setup 固定 8 步，Character Loop 每轮 5 步）
