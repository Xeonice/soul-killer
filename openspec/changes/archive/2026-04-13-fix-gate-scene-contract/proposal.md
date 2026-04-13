## Why

`affinity_gate` 场景在生成管线中存在契约不一致：LLM 生成的 gate draft 缺少 `type` 和 `choices` 字段，script-builder 不补全这些字段，而下游 `script.ts` parser 对所有场景统一要求 `choices` 数组——导致 `state init` 直接失败。即使手动修复后，tree 可视化也因为不传递 `routing` 数据、BFS 不跟踪 routing 出边而在 gate 处断裂，gate 后的全部路线场景不可见。

## What Changes

- script-builder `runScriptScene` 对 gate 场景自动补全 `type: "affinity_gate"` + `choices: []`，并从 plan 拷贝 `routing`，不依赖 LLM 记得输出这些字段
- script-builder `runScriptScene` 对 route 场景自动注入 `route` 标签（从 plan 的 routes 结构推导），保证 tree 可视化能按路线着色
- `script.ts` parseScene 识别 `affinity_gate` 类型：gate 场景允许 `choices` 缺失（默认 `[]`），解析并保留 `routing` 字段
- tree-server `loadTreeData` 将 `routing` 数据传给前端
- tree-html BFS 遍历对 gate 场景额外跟踪 `routing[].next`，生成 edge 并发现后续场景
- tree-html gate 菱形渲染修复：内容区 overflow 控制，防止文字溢出覆盖相邻节点

## Capabilities

### New Capabilities

（无）

### Modified Capabilities

- `skill-runtime-state`: script.ts parseScene 需要识别 affinity_gate 场景类型，对 gate 允许 choices 缺失并解析 routing
- `script-builder`: runScriptScene 对 gate 场景自动补全结构字段，对 route 场景自动注入 route 标签
- `branch-tree-server`: loadTreeData 传递 routing 数据，BFS 跟踪 routing 出边，gate 菱形渲染修复

## Impact

- `src/export/state/script.ts` — parseScene 函数修改
- `src/export/state/script-builder.ts` — runScriptScene gate 路径增加字段补全逻辑
- `src/export/state/tree-server.ts` — loadTreeData 增加 routing 字段
- `src/export/state/tree-html.ts` — BFS 遍历逻辑 + CSS 样式修复
- 现有 unit tests 需要更新：`script-builder.test.ts` 的 gate 场景用例
- 需要新增 tests：parseScene 对 gate 场景的处理、tree 数据中 routing 传递
