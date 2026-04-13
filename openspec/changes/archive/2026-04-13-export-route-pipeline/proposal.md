## Why

路线系统的 CLI 基础设施（affinity_gate、state route、script-builder 路线验证）已全部实现，但 export agent 的 prompt 和工作流完全没有路线意识。导致：

1. Planning prompt 不分析路线候选角色 → plan JSON 无 route_candidates
2. 工作流缺少 Route Selection 步骤 → 角色添加后直接 finalize
3. story-spec 无 Routes 段落 → SKILL.md 条件路线指引不激活
4. Phase 1 LLM 生成单线叙事 → 所有 choice.next 指向同一场景

需要打通从 planning → route selection → story-spec → SKILL.md → plan validation 的完整链路。

## What Changes

### 1. Planning Prompt 加路线意识
- `prompts.ts` PLANNING_PROMPT：分析角色时评估路线潜力，plan_story 工具输出 route_candidates
- `planning.ts` plan_story 工具：新增 route_candidates 参数

### 2. 新增 Route Selection 步骤
- 新增 `route-selection.ts`：runRouteSelection 函数
- 新增 ROUTE_SELECTION_PROMPT：agent 基于 plan.route_candidates 推荐焦点角色，ask_user 展示预选列表，用户确认/调整，调用 select_route_characters
- `index.ts`：在 runCharacterLoop 后、finalizeAndPackage 前插入 runRouteSelection

### 3. SKILL.md 路线指引从条件性改为强制性
- story-spec 有 Routes 段落时，Phase 1 plan **必须**包含 affinity_gate + routes
- `script-builder.ts` runScriptPlan：检测 story-spec Routes → plan 必须有 routes + gate

### 4. 整体 Workflow 说明更新
- prompts.ts 的全局 Workflow 文档更新为 6 步（加 route selection）

## Capabilities

### New Capabilities
- `export-route-pipeline`：planning 路线意识 + route selection 交互 + story-spec→skill 强制链路

### Modified Capabilities
- `export-agent`：workflow 从 5 步扩展为 6 步
- `script-builder`：plan 验证可检测 story-spec Routes 一致性
- `skill-runtime-state`：SKILL.md 路线指引从 "if" 改为 "must"

## Impact

- **新文件**：`src/export/agent/route-selection.ts`
- **修改文件**：`prompts.ts`（planning + workflow）、`planning.ts`（plan_story 工具）、`index.ts`（workflow 插入步骤）、`skill-template.ts`（条件→强制）、`script-builder.ts`（plan 验证扩展）
- **不改**：story-setup.ts 中已有的 select_route_characters 工具定义（已实现）
