## 1. 类型与事件定义

- [x] 1.1 定义 `ExportPlan` / `ExportPlanCharacter` 类型并从 export-agent 模块导出
- [x] 1.2 扩展 `ExportPhase` 类型，新增 `planning` 和 `plan_review`
- [x] 1.3 扩展 `ExportProgressEvent` 联合类型，新增 `plan_ready` 和 `plan_confirmed` 事件

## 2. Planning Agent 核心

- [x] 2.1 编写 `PLANNING_SYSTEM_PROMPT`（资料使用守则、角色关系分析指引、role 分配指引、shared_axes/flags 设计指引）
- [x] 2.2 实现 `submit_plan` 工具（zod schema + execute 函数 + 6 项程序校验）
- [x] 2.3 实现 `runPlanningLoop` 函数（ToolLoopAgent 实例、stepCap=5、stopWhen、进度事件、错误处理）

## 3. Plan 确认交互（代码层）

- [x] 3.1 在 runExportAgent 中实现 plan 确认等待逻辑（发送 plan_ready 事件、等待用户响应、处理取消）
- [x] 3.2 在 ExportCommand 中实现 plan 确认回调（onPlanConfirm / onCancel 信号传递）

## 4. Execution Agent 改造

- [x] 4.1 将现有 SYSTEM_PROMPT 改造为 EXECUTION_SYSTEM_PROMPT，新增"按 plan 执行"指引
- [x] 4.2 改造 `buildInitialPrompt` 接收 plan JSON 并注入 "# 执行计划" 块
- [x] 4.3 修复 stopWhen：将 `hasToolCall('finalize_export')` 替换为 `finalizeSucceeded` flag 判断
- [x] 4.4 将原 runExportAgent 主体提取为 `runExecutionLoop` 函数

## 5. runExportAgent 三阶段编排

- [x] 5.1 重构 runExportAgent 为 Planning → 确认 → Execution 三阶段流程
- [x] 5.2 Planning 失败时直接报错，不进入 Execution
- [x] 5.3 用户取消时清理并返回

## 6. UI — ExportProtocolPanel 改造

- [x] 6.1 新增 `plan_review` ActiveZone 类型定义和渲染逻辑（角色编排表 + 方向摘要 + Enter/Esc 提示）
- [x] 6.2 新增双阶段分隔线渲染（`── 规划 ──` / `── 执行 ──`）
- [x] 6.3 实现执行阶段 trail 按角色分组逻辑（合并 add_character + set_character_axes 为单行）
- [x] 6.4 新增 planning phase idle 显示（"规划中" 替代 "思考中"）
- [x] 6.5 `reducePanelEvent` 处理 `plan_ready` 和 `plan_confirmed` 事件

## 7. i18n

- [x] 7.1 zh/en/ja 新增规划阶段 i18n key（planning/plan_review/plan_confirm 等）

## 8. 测试

- [x] 8.1 单元测试：submit_plan 校验逻辑（6 项校验的通过/失败路径）
- [x] 8.2 单元测试：reducePanelEvent plan 事件处理 + 角色分组
- [x] 8.3 单元测试：planningTrail routing during planning phase
- [x] 8.4 单元测试：character grouping merges add_character + set_character_axes
