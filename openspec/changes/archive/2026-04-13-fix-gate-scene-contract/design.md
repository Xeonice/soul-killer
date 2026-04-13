## Context

`affinity_gate` 场景在 skill-route-system 和 export-route-pipeline 两个 change 中引入，但生成管线的各环节对 gate 场景的结构约束不一致：

- **script-builder**（plan 验证 + scene 生成）：正确识别 gate，验证 routing，但 `runScriptScene` 的 gate 路径只做 JSON 合法性校验，不补全结构字段
- **script.ts parser**：对所有场景统一要求 `choices` 数组，不认识 `affinity_gate` 类型
- **tree-server + tree-html**：`loadTreeData` 不传递 `routing`，BFS 只跟踪 `choices[].next`，gate 菱形 CSS 在旋转后文字溢出

LLM 在 Phase 1 生成 gate scene draft 时，往往只输出 `{ text, routing }` 而漏掉 `type` 和 `choices` 字段。由于 script-builder 的 gate 路径不校验也不补全这些字段，它们原样进入最终 script.json，然后在 `state init` 时被 parser 拒绝。

## Goals / Non-Goals

**Goals:**

- Gate 场景生成的结构性正确：不依赖 LLM 记住输出 `type` / `choices`，由 script-builder 从 plan 信息确定性补全
- Route 场景的 `route` 标签自动注入：script-builder 从 plan 的 routes 结构推导每个场景的归属路线
- `script.ts` parser 能正确解析 gate 场景（防御性，不再因缺 choices 而 crash）
- Tree 可视化完整展示 gate 后的三条（或 N 条）路线分支
- Gate 菱形节点渲染正确，不溢出覆盖相邻节点

**Non-Goals:**

- 不修改 SKILL.md 模板的 LLM prompt（那是概率优化，不是结构性保证）
- 不修改 Phase 2 gate handling 运行时逻辑（`state route` 命令本身工作正常）
- 不新增 state CLI 子命令

## Decisions

### Decision 1: script-builder 作为 gate 字段的 single source of truth

**选择**：在 `runScriptScene` 的 gate 路径中，从 plan 拷贝 `type`、`routing`，补 `choices: []`，然后写入最终 scene JSON。

**替代方案**：改 SKILL.md prompt 让 LLM 输出完整字段 → 拒绝，因为 prompt 是概率性的，不能保证 100% 正确。

**理由**：script-builder 已经在 `runScriptPlan` 阶段完整验证了 gate 的 routing 结构。gate 的结构字段（type、routing、choices=[]）完全可从 plan 信息确定性推导，无需依赖 LLM draft。

### Decision 2: route 标签由 script-builder 注入而非 LLM 输出

**选择**：`runScriptScene` 在处理普通场景时，检查该 scene-id 是否属于某条 route（从 plan.routes[].scenes 查找），是则注入 `route` 字段。

**替代方案**：要求 LLM 在每个 route 场景的 draft JSON 中输出 `route` 字段 → 拒绝，同理 LLM 容易漏。

**理由**：plan 的 `routes` 数组已经明确定义了每条 route 包含的 scene-ids，这是确定性信息。

### Decision 3: script.ts parseScene 增加 gate 防御性解析

**选择**：parseScene 检查 `raw.type === 'affinity_gate'`，若是则 `choices` 默认 `[]`，解析 `routing` 到 ScriptScene 的新字段。

**替代方案**：只在 script-builder 侧补全，不改 parser → 拒绝，因为 parser 应该能正确表示所有场景类型，且手动编辑的 script.json 也应被正确解析。

### Decision 4: tree-html gate edge 使用虚拟 edge 表示路由分支

**选择**：BFS 遇到 gate 场景时，读取 `scene.routing[]`，对每个 routing entry 生成一条 edge（from=gate, to=routing.next），edge 带 `route_id` 标签用于着色。

**理由**：gate 没有 choices，但 routing 语义上等价于"系统自动选择的多分支"，视觉上应该和 choices edge 一致。

### Decision 5: gate 菱形使用 clip-path 代替 rotate

**选择**：用 `clip-path: polygon(50% 0%, 100% 50%, 50% 100%, 0% 50%)` 裁切节点为菱形，而非 `transform: rotate(45deg)` + 子元素反旋转。

**替代方案**：保留 rotate 但增大 slot 间距 → 拒绝，rotate 方案导致 bounding box 膨胀（140px → 198px），文字区域受限且需要反旋转子元素，复杂度高。

**理由**：clip-path 不改变 bounding box，文字自然水平排列，不需要反旋转，slot 间距无需特殊处理。gate 内容精简为 `[ GATE ]` 标签 + route 数量标注即可。

## Risks / Trade-offs

- **[Risk] script-builder 补全逻辑增加了 gate 路径的复杂度** → Mitigation: gate 路径已经是独立分支，补全逻辑是 3 行赋值，且有 plan 验证在前保证 routing 合法
- **[Risk] parseScene 新增 routing 字段可能影响下游消费者** → Mitigation: routing 是可选字段，现有消费者（init, apply, validate, rebuild）只读 choices，不受影响
- **[Risk] clip-path 方案的浏览器兼容性** → Mitigation: `clip-path: polygon()` 在所有现代浏览器均已支持（Can I Use 98%+），tree 页面的目标用户是开发者本机浏览器
- **[Trade-off] route 标签注入依赖 plan.routes 结构** → 如果 plan 没有 routes（无路线的 skill），不注入，行为与现有一致
