## 1. script.ts parser — gate 防御性解析

- [x] 1.1 ScriptScene 接口新增可选字段：`type?: string`、`routing?: ScriptRouting[]`、`route?: string`；新增 ScriptRouting 接口
- [x] 1.2 parseScene 检查 `raw.type === 'affinity_gate'`：gate 场景 `choices` 默认 `[]`，解析 `routing` 字段；普通场景行为不变
- [x] 1.3 新增 unit tests：gate 无 choices 不抛错、gate 有 choices=[] 正常、gate 保留 routing、普通场景缺 choices 仍抛错

## 2. script-builder — gate 字段补全 + route 标签注入

- [x] 2.1 `runScriptScene` gate 路径：从 plan 拷贝 `type` + `routing` 到最终 scene JSON，补全 `choices: []`
- [x] 2.2 `runScriptScene` 普通场景路径：从 plan.routes 查找 scene-id 归属，注入 `route` 字段
- [x] 2.3 更新现有 script-builder tests 中的 gate 场景用例，新增 gate 补全 + route 注入 tests

## 3. tree-server — 传递 routing 数据

- [x] 3.1 `loadTreeData` 中 scene 数据对象增加 `routing: rawScene?.routing`
- [x] 3.2 验证 `/data` 端点返回的 gate 场景包含 routing 数组

## 4. tree-html — BFS 遍历 + gate 渲染修复

- [x] 4.1 renderTree BFS：gate 场景额外遍历 `scene.routing[].next`，为每条生成 edge（带 route_id 标签）并入队后续场景
- [x] 4.2 gate edge 着色：routing edge 使用 ROUTE_COLORS 按 route index 着色
- [x] 4.3 gate 菱形改用 `clip-path: polygon(50% 0%, 100% 50%, 50% 100%, 0% 50%)` 替代 `transform: rotate(45deg)`，移除子元素反旋转 CSS
- [x] 4.4 gate 节点内容精简：显示 `[ GATE ]` + route 数量标注，移除溢出的 text 内容
- [x] 4.5 endings 发现逻辑：除了从 choices[].next 发现 ending，也从 routing[].next 链路末端发现 ending

## 5. 端到端验证

- [x] 5.1 用 Playwright 截图验证：gate 菱形渲染正确、gate 后三条路线完整显示、路线着色区分
