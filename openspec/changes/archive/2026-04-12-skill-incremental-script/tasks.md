## 1. script-builder CLI

- [x] 1.1 创建 `src/export/state/script-builder.ts`：plan.json 类型定义（含 narrative/scenes/endings/context_refs），`runScriptPlan` 函数（验证 + 自动补全 predecessors/is_convergence/generation_order + 写回 plan.json）
- [x] 1.2 实现拓扑排序：Kahn's algorithm，检测环并报错
- [x] 1.3 实现 `runScriptScene` 函数：读 draft + plan → 验证 JSON 语法 + scene-id 存在 + choices 匹配 plan + consequences ⊂ schema + next 匹配 + predecessors 已就绪 → 移到 scenes/
- [x] 1.4 实现 `runScriptEnding` 函数：读 draft + plan → 验证 JSON + ending-id 存在 + body 非空 → 移到 endings/
- [x] 1.5 实现 `runScriptBuild` 函数：读 plan + scenes + endings → 验证完整性 → 合并为 script-<id>.json（和现有格式一致）→ 清理 .build/
- [x] 1.6 修改 `main.ts`：注册 `script plan` / `script scene` / `script ending` / `script build` 子命令

## 2. SKILL.md 模板重写

- [x] 2.1 重写 Phase 1 为五步：Step A (Plan) → Step B (Scenes 按 generation_order) → Step C (Endings) → Step D (Build) → Step E (Self-check)
- [x] 2.2 Step B 指令：读 plan + predecessors + context_refs；is_convergence 时路径无关约束
- [x] 2.3 Step C 指令：读 plan intent + key_scenes 生成 ending body
- [x] 2.4 更新 script.json 结构说明（最终格式不变，描述增量过程）
- [x] 2.5 Phase 2 choices 限制：每个场景 ≤ 2 choices，所有相关规则同步
- [x] 2.6 Phase 2 自动启动 `state tree <script-id>`，告知用户可视化 URL

## 3. 单元测试

- [x] 3.1 创建 `tests/unit/export/state/script-builder.test.ts`：plan 验证（合法 plan / choices 超限 / 孤立节点 / schema 不匹配 / context_refs 引用不存在 / 环检测）
- [x] 3.2 plan 自动补全测试：predecessors 计算正确 / is_convergence 标注 / generation_order 拓扑序
- [x] 3.3 scene 验证测试：合法场景 / consequences 无效 key / JSON 语法错误 / scene-id 不在 plan / predecessors 未就绪
- [x] 3.4 ending 验证测试：合法结局 / condition 引用无效 key / body 为空
- [x] 3.5 build 测试：全部就绪→合并成功→格式正确 / 场景缺失→报错 / 结局缺失→报错
- [x] 3.6 修改 `main.test.ts`：script 子命令分发测试

## 4. 验证

- [x] 4.1 运行 `bun run test` 确认全部测试通过（84 文件 970 用例）
- [x] 4.2 端到端验证由 script-builder.test.ts 的 build 测试覆盖（plan → scene ×N → ending ×M → build → 验证产物格式）
