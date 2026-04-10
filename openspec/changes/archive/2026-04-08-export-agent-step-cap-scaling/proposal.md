## Why

Export agent 的 step cap 硬编码为 `stepCountIs(20)`（`src/agent/export-agent.ts:1231`）。这个数字是在只有 4 步工作流（set_story_metadata + add_character + set_character_axes + finalize_export）、最多 4 角色的老版本里设的，4 角色时 `3 + 4×2 + 1 = 12 步`，配 8 步死循环保险余量，合理。

之后一系列 change 逐步扩展了工作流但从未重新审视这个上限：

- `story-level-state` 新增 `set_story_state` → +1 步
- `prose-style-anchor` 新增 `set_prose_style` → +1 步
- `story-level-state` 取消了 4 角色上限，允许任意多角色
- `phase1-full-read-enforcement` 没加新工具但放大了每步的内容量

现在一个 9 角色 skill 需要的最小步数是 `3 + 9×2 + 1 = 22 步`，**数学上大于硬上限 20**，必然失败。实测用 `three-kingdom-chibi` 9 角色 skill 导出时，agent 在第 15-20 步耗尽，刚注册完 6/9 角色就被强制终止，报 "导出代理意外终止（未调用 finalize_export），已执行 20 步"。

错误消息本身也不清晰：用户看到"已执行 20 步"不知道 20 是硬上限，还是 LLM 随机 bug。

## What Changes

- 把 export-agent.ts 里的 `stepCountIs(20)` 改为**基于角色数的动态计算**：`minimalSteps + safetyBuffer`，其中 `minimalSteps = 3 (setup) + N × 2 (per character) + 1 (finalize)`，`safetyBuffer = max(5, N)`
- 提取为一个命名常量 `STEP_SETUP_BASELINE = 3` + `STEP_FINALIZE = 1` + 辅助函数 `computeExportStepCap(characterCount)`，让以后扩展工具时能明确看到 baseline 公式
- 当 agent 因 step cap 终止时（而非 LLM 主动终止），error 消息必须明确提及"达到 step 上限"而不是"意外终止"，并显示已注册角色数和总数
- 单测覆盖：4 角色 → 17 步 / 9 角色 → 31 步 / 2 角色 → 13 步

## Capabilities

### New Capabilities
- 无

### Modified Capabilities
- `export-agent`: 工具调用的 step cap 从硬编码 20 改为基于角色数的动态公式；错误消息明确 step cap 耗尽路径

## Impact

**代码**
- `src/agent/export-agent.ts` —— 新增 `computeExportStepCap()` 辅助函数 + 用它替换 `stepCountIs(20)`；错误处理分支区分"step cap 耗尽"与"其他未调用 finalize 情况"

**测试**
- `tests/unit/export-builder.test.ts` 或新建 `tests/unit/export-step-cap.test.ts` 新增单测覆盖公式

**依赖**
- 无

**向后兼容**
- 完全向后兼容。现有少角色 skill（2-4 角色）的 step cap 会从 20 变成 13-17，仍然够用（LLM 正常流程不会跑到上限）
