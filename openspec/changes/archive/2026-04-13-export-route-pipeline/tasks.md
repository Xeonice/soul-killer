## 1. Planning Prompt 路线意识

- [x] 1.1 修改 `prompts.ts` PLANNING_PROMPT：Step 1 加路线潜力分析指引，plan_story 输出要求包含 route_candidates
- [x] 1.2 修改 `planning.ts` plan_story 工具：新增 route_candidates 参数 + planBuilder 类型扩展
- [x] 1.3 更新 `types.ts` ExportPlan + RouteCandidate 类型

## 2. Route Selection 步骤

- [x] 2.1 创建 `src/export/agent/route-selection.ts`：runRouteSelection 函数（纯代码，不需要 LLM）
- [x] 2.2 修改 `index.ts`：在 runCharacterLoop 后插入 runRouteSelection 调用
- [x] 2.3 处理边界情况：candidates 为空跳过 / 用户可用逗号分隔自定义列表 / max 4

## 3. SKILL.md 强制路线

- [x] 3.1 修改 `skill-template.ts` SkillTemplateConfig：新增 routeCharacters 字段
- [x] 3.2 有 routeCharacters 时：字符串替换 "if story-spec defines routes" → "MANDATORY — N routes, you MUST create affinity_gate"
- [x] 3.3 无 routeCharacters 时：保持现有条件性指引（兼容）
- [x] 3.4 packager.ts 传递 story_spec.route_characters → generateSkillMd

## 4. Workflow 文档更新

- [x] 4.1 更新 `prompts.ts` 整体 Workflow 说明：Step 4.5 route selection + Step 5 finalize

## 5. 验证

- [x] 5.1 运行 `bun run test` 确认全部测试通过（85 文件 983 用例）
- [x] 5.2 SkillTemplateConfig 类型更新兼容，packager 传递链完整
