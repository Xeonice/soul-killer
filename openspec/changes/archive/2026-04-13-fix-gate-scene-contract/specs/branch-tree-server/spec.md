## MODIFIED Requirements

### Requirement: HTML 可视化

GET / 返回的 HTML SHALL 渲染交互式分支树。

#### Scenario: 基础渲染

- **WHEN** 浏览器打开 TREE_URL
- **THEN** SHALL 显示所有场景节点和选择边，区分已走过（cyan）、当前（yellow）、未探索（gray）

#### Scenario: 实时更新

- **WHEN** LLM 执行 apply 后
- **THEN** 浏览器 SHALL 自动更新树，新节点亮起，路径线变色

#### Scenario: 环检测

- **WHEN** 场景图存在回路（scene-A → scene-B → scene-A）
- **THEN** SHALL 标注回路节点，不无限展开

#### Scenario: gate 场景通过 routing 连接后续路线

- **WHEN** 场景数据包含 `type: "affinity_gate"` 且有 `routing` 数组
- **THEN** BFS SHALL 为每个 `routing[].next` 生成 edge 并发现后续场景节点，gate 后的全部路线场景 SHALL 可见

#### Scenario: gate 后路线边按 route 着色

- **WHEN** gate 的 routing 有多条 entry（每条有 route_id）
- **THEN** 从 gate 到各路线首场景的 edge SHALL 使用对应路线颜色，路线内场景节点 SHALL 按 route 字段着色

#### Scenario: gate 菱形渲染不溢出

- **WHEN** gate 场景渲染为菱形节点
- **THEN** 菱形 SHALL 使用 clip-path 裁切（非 rotate），内容不超出节点边界，不覆盖相邻节点

## ADDED Requirements

### Requirement: loadTreeData 传递 routing 数据

tree-server 的 `/data` 端点 SHALL 在 scene 数据中包含 `routing` 字段。

#### Scenario: gate 场景的 routing 可用

- **WHEN** 前端请求 `/data`
- **THEN** gate 场景的数据对象 SHALL 包含 `routing` 数组（从 raw script 读取）

#### Scenario: 非 gate 场景无 routing

- **WHEN** 普通场景无 routing
- **THEN** scene 数据对象 SHALL 不包含 `routing` 字段（或为 undefined）
