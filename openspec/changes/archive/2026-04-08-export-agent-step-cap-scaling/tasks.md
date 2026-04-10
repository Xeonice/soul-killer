## 1. 提取常量与辅助函数

- [x] 1.1 在 `src/agent/export-agent.ts` 顶部新增三个常量：`STEP_SETUP_BASELINE = 3` / `STEP_PER_CHARACTER = 2` / `STEP_FINALIZE = 1`，每个常量带 JSDoc 明确列出对应的 tool 名（set_story_metadata / set_story_state / set_prose_style 等）
- [x] 1.2 新增并导出 `computeExportStepCap(characterCount: number): number` 函数，公式：`(STEP_SETUP_BASELINE + characterCount * STEP_PER_CHARACTER + STEP_FINALIZE) + Math.max(5, characterCount)`
- [x] 1.3 函数签名加 JSDoc 说明"用于 tool-loop stopWhen 的动态上限，防 LLM 死循环但不限制正常流程"

## 2. 替换硬编码 stepCountIs(20)

- [x] 2.1 定位 `stopWhen: [stepCountIs(20), hasToolCall('finalize_export')]`
- [x] 2.2 在 runExportAgent 顶部计算 `const stepCap = computeExportStepCap(preSelected.souls.length)`
- [x] 2.3 替换为 `stopWhen: [stepCountIs(stepCap), hasToolCall('finalize_export')]`

## 3. 错误消息明确 step cap 耗尽原因

- [x] 3.1 定位 agent 运行后检查 finalize_export 是否被调用的分支
- [x] 3.2 在"未调用 finalize_export"的错误分支里，检查实际步数是否 ≥ stepCap
- [x] 3.3 如果 ≥ stepCap：错误消息改为 `导出代理达到 step 上限（${stepCap} 步，${characterCount} 角色）。已注册 ${builder.characterCount()}/${characterCount} 个角色。请检查是否 LLM 在某些步骤上反复 retry。`
- [x] 3.4 否则：保留原有 "未调用 finalize_export，已执行 X 步" 消息

## 4. 单测

- [x] 4.1 新建 `tests/unit/export-step-cap.test.ts`
- [x] 4.2 覆盖公式对 1/2/4/6/9/12/20 角色的返回值与 design.md 的表格一致
- [x] 4.3 覆盖 edge case：0 角色返回合理值（虽然实际不会发生，防止负数）
- [x] 4.4 不做 runExportAgent 端到端测试（涉及真实 LLM，成本太高）

## 5. 验证

- [x] 5.1 `bun run build` 无 TS 错误
- [x] 5.2 `bun vitest run tests/unit/` 全绿
- [ ] 5.3 (manual) 重新 export three-kingdom-chibi 9 角色 skill，验证能成功跑完 finalize_export
