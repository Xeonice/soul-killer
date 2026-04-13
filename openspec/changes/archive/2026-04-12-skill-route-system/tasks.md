## 1. state route 命令

- [x] 1.1 创建 `src/export/state/route.ts`：`runRoute` 函数 + `evaluateCondition` 共享评估器
- [x] 1.2 condition 评估逻辑：新写独立评估器（all_of/any_of/not/comparison），支持 >=/<=/>/</==/!= + default
- [x] 1.3 修改 `main.ts`：注册 `route` 子命令
- [x] 1.4 修改 `io.ts`：MetaFile 新增 `currentRoute?: string`，readMetaFile/serializeMetaFile 同步

## 2. script-builder 路线支持

- [x] 2.1 修改 `script-builder.ts` plan 类型：新增 `PlanRoute` + `PlanRoutingEntry` + `PlanScene.type/routing/route` + `PlanEnding.route` + `ScriptPlan.routes`
- [x] 2.2 `runScriptPlan` 扩展验证：gate routing 有 default / routing.next 有效 / 每条路线至少 1 ending / 路线场景存在
- [x] 2.3 `runScriptScene` 扩展：gate 场景跳过 text+choices 验证，直接验证 JSON + 前驱就绪
- [x] 2.4 拓扑排序 + predecessors 计算兼容 gate 的 routing edges

## 3. SKILL.md 模板更新

- [x] 3.1 Phase 1 plan 阶段：路线设计指引——共通线 + gate + 路线场景 + 路线 endings
- [x] 3.2 Phase 1 scene 生成：gate 场景从 plan 复制 routing JSON
- [x] 3.3 Phase 2 gate 处理：遇到 affinity_gate 时调用 state route，自动转场，叙事化告知路线
- [x] 3.4 Phase 2 ending 评估：只看 current_route 的 endings

## 4. export agent 焦点角色选取

- [x] 4.1 创建 `select_route_characters` 工具：分析角色数据 → 评估路线潜力 → 预选列表
- [x] 4.2 export agent 流程集成：story-setup.ts 新增工具 + types.ts ExportBuilder 扩展
- [x] 4.3 story-spec Routes 段落生成：story-spec.ts 新增 formatRoutesSection

## 5. 分支树可视化增强

- [x] 5.1 `tree-server.ts` /data 返回 routes + gateScenes 信息
- [x] 5.2 `tree-html.ts` 路线着色：ROUTE_COLORS + getRouteColor + 动态路线图例
- [x] 5.3 `tree-html.ts` gate 节点菱形渲染（CSS rotate(45deg) + dashed border）

## 6. 单元测试

- [x] 6.1 创建 `tests/unit/export/state/route.test.ts`：evaluateCondition 5 用例 + runRoute 4 用例
- [x] 6.2 更新 `script-builder.test.ts`：gate 验证 3 用例（routing default / 无 default 拒绝 / 路线无 ending）
- [x] 6.3 更新 `main.test.ts`：route 子命令分发

## 7. 验证

- [x] 7.1 运行 `bun run test` 确认全部测试通过（85 文件 983 用例）
- [x] 7.2 端到端由 route.test.ts 覆盖（构造带 gate 的 script → init → apply → route → 验证路由结果和 meta.yaml）
