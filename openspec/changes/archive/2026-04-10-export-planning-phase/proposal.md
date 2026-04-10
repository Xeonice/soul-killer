## Why

Export agent 当前是单程线性工作流 — LLM 拿到数据后直接按 Step 1-5 调用工具，没有规划阶段也没有完成校验。这导致两个已观察到的问题：

1. **漏步** — 6 角色导出中，間桐桜的 `set_character_axes` 被 LLM 跳过，`finalize_export` 校验失败后因 `stopWhen` 条件（`hasToolCall('finalize_export')`）立即终止，agent 没有机会修正重试。
2. **不可预览** — 用户在 agent 完成前无法看到 role 分配、轴设计等创意决策是否符合预期，只能等到打包完成或失败后才发现问题。

将 export agent 拆分为 Planning Agent + Execution Agent 双循环，在执行前强制输出结构化 plan 并暂停让用户确认。

## What Changes

- **新增 Planning Agent 循环**：独立的 LLM 循环，分析 soul/world 数据后输出结构化 plan（薄 plan：方向性决策而非完整参数），通过 `submit_plan` 工具提交，程序校验 plan 完整性（角色覆盖、shared_axes 数量、role 分配）
- **新增 Plan 确认交互**：Planning Agent 结束后、Execution Agent 启动前，UI 展示 plan 详情（角色编排表、类型/基调方向、轴设计），用户按 Enter 继续或 Esc 取消
- **Execution Agent 接收 plan**：Execution Agent 的 initial prompt 包含 plan JSON + soul/world 全文，按 plan 方向细化参数并调用现有工具集
- **修复 `finalize_export` stopWhen bug**：改为仅在 `finalize_export` 成功时触发停止条件，失败后 agent 可修正重试
- **UI 双阶段呈现**：ExportProtocolPanel 展示"规划"和"执行"两个阶段，用分隔线区分；执行阶段的 trail 按角色分组（合并 `add_character` + `set_character_axes` 为单行）

## Capabilities

### New Capabilities
- `export-planning-agent`: Planning Agent 循环 — submit_plan 工具、plan schema、plan 校验逻辑、planning system prompt
- `export-plan-review`: Plan 确认交互 — plan_review ActiveZone、确认/取消交互、plan 摘要渲染

### Modified Capabilities
- `export-agent`: 拆分为双循环架构，Execution Agent 接收 plan 作为输入，修复 finalize_export stopWhen 条件
- `export-protocol-panel`: 新增 planning phase、plan_review zone、双阶段分隔线、按角色分组的 trail

## Impact

- `src/agent/export-agent.ts` — 主要改动文件：拆分 runExportAgent、新增 Planning Agent 循环、修复 stopWhen
- `src/cli/animation/export-protocol-panel.tsx` — UI 双阶段渲染、plan_review zone、角色分组 trail
- `src/i18n/locales/{zh,en,ja}.json` — 规划阶段相关 i18n key
- `openspec/specs/export-agent/spec.md` — 更新 spec 反映双循环架构
- `tests/unit/export-tools.test.ts` — Planning Agent 工具测试
- `tests/component/export-protocol-panel.test.tsx` — 双阶段 UI 测试
- Step cap 常量需要分别为 Planning 和 Execution 各自计算
