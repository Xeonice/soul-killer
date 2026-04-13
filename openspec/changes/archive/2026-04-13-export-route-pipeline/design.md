## Context

路线系统基础设施已就位：affinity_gate 场景类型、state route 命令、script-builder 路线验证、select_route_characters 工具、tree-html 路线着色。但 export agent 的 prompt 和工作流不知道这些存在。

当前 export 工作流：Planning → Plan Confirm → Story Setup → Character Loop → Finalize

## Goals / Non-Goals

**Goals:**
- Planning 阶段输出路线候选角色
- 用户可交互选择/调整焦点角色
- story-spec 自动生成 Routes 段落
- SKILL.md 在有 Routes 时强制路线叙事
- plan 验证在有 Routes 时强制 gate + routes

**Non-Goals:**
- 不改已实现的 CLI 基础设施（route.ts, script-builder.ts 的路线类型等）
- 不改 select_route_characters 工具定义（已在 story-setup.ts 中）
- 无路线的简单 skill 仍然可以导出（兼容）

## Decisions

### 1. Planning Prompt 修改

PLANNING_PROMPT 的 Step 1（分析角色关系）扩展，加入路线潜力评估：

```
Step 1: 分析角色关系 + 路线潜力
  对每个角色评估：
  - 内在矛盾深度（identity 中的矛盾描述）
  - 与其他角色的关系张力
  - 角色弧线完整度（behaviors 文件数/内容丰富度）
  - 是否有足够素材支撑独立路线
  → 输出 route_candidates: top 2-3 角色
```

plan_story 工具新增 `route_candidates` 参数：

```ts
route_candidates: z.array(z.object({
  slug: z.string(),
  name: z.string(),
  reason: z.string(),
})).describe('Top 2-3 characters recommended as route focus, with reasoning')
```

plan JSON 输出中增加 `route_candidates` 字段。用户在 Plan Confirm 阶段可以看到推荐的路线角色。

### 2. Route Selection 步骤

新增 `route-selection.ts`，在 Character Loop 完成后执行。

流程：
1. 读取 plan.route_candidates 作为预选
2. 构造 ask_user 消息，展示预选列表 + 推荐理由
3. 用户返回确认/调整后的列表
4. 调用 builder.setRouteCharacters()

ROUTE_SELECTION_PROMPT（给 LLM agent 的 prompt）：

```
你是路线角色选取助手。根据 plan 的 route_candidates 推荐和已添加的角色数据，
完成焦点角色选取。

流程：
1. 展示预选列表给用户（通过 ask_user），标注推荐理由
2. 用户确认/调整后，调用 select_route_characters
3. 完成后 stop

预选列表格式：
"以下角色推荐作为独立路线焦点（最多 4 个）：
 ☑ 角色A — 推荐理由...
 ☑ 角色B — 推荐理由...
 ☐ 角色C — 可选，理由...
请确认或调整。直接回复 '确认' 或列出你想要的角色。"
```

但实际上这个交互不需要 LLM agent——可以直接用代码实现（构造 ask_user 消息，解析用户回复）。考虑到简洁性，直接在 `route-selection.ts` 中用代码完成，不启动额外的 LLM loop。

### 3. index.ts 工作流插入

```ts
// 现在
const charsOk = await runCharacterLoop(...)
const finalOk = await finalizeAndPackage(...)

// 改后
const charsOk = await runCharacterLoop(...)
const routeOk = await runRouteSelection(plan, builder, preSelected, onProgress, askUser)
const finalOk = await finalizeAndPackage(...)
```

runRouteSelection 是纯代码（不需要 LLM），逻辑：
1. 从 plan.route_candidates 取预选
2. 如果没有 route_candidates 或只有 1 个角色 → 跳过（不强制路线）
3. 构造消息，调用 askUser
4. 解析用户回复，调用 builder.setRouteCharacters

### 4. SKILL.md 强制路线

`skill-template.ts` 中的 Phase 1 路线指引修改：

```
现在: "**Route Structure (if story-spec defines routes):**"
改后: 检测 story-spec 是否有 Routes → 如果有，生成不同的 SKILL.md 模板

在 generateSkillMd 函数中:
  if (config.route_characters && config.route_characters.length > 0) {
    // Phase 1 plan instructions 中 routes 是 MANDATORY
    // "You MUST create an affinity_gate scene and route-specific scenes"
  } else {
    // 保持现有的条件性指引（兼容无路线 skill）
  }
```

### 5. plan 验证强化

`script-builder.ts` runScriptPlan：

目前无法在 CLI 层面检测 story-spec（它在 skill 目录外层），但可以在 SKILL.md 模板层面强制——如果模板本身就写的是 "MUST create routes"，LLM 不创建就违反了模板约束。

更实际的做法：如果 plan.json 中有 `routes` 数组，现有验证已经确保 gate + route endings 合法。如果没有 `routes`，现有验证也能通过（兼容）。

**真正的强制点在 SKILL.md 模板**——模板根据 route_characters 是否存在，生成不同的 Phase 1 指令（mandatory vs optional）。

## Risks / Trade-offs

| 风险 | 缓解 |
|------|------|
| Planning LLM 推荐的角色不合理 | 用户在 ask_user 交互中可以完全覆盖 |
| 用户回复 ask_user 格式不标准 | 提供明确的回复模板，容错解析 |
| 单角色 skill 被强制路线 | route_candidates 为空或 1 个角色时跳过 |
| SKILL.md 模板变复杂 | 仅在有 route_characters 时注入强制指令，无路线时模板不变 |
