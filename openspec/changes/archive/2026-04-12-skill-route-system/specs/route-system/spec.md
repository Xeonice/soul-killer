## ADDED Requirements

### Requirement: affinity_gate 场景类型

script.json SHALL 支持 `type: "affinity_gate"` 的场景，该场景不展示选项，而是基于状态值自动路由到不同路线。

#### Scenario: gate 按条件路由

- **WHEN** Phase 2 到达 affinity_gate 场景，且 state 中 `affinity.kiritsugu.bond >= 6` 且 `flags.chose_pragmatism == true`
- **THEN** SHALL 自动路由到 kiritsugu-route 的首个场景

#### Scenario: gate default 兜底

- **WHEN** 没有任何 routing condition 满足
- **THEN** SHALL 路由到 `condition: "default"` 指定的路线

#### Scenario: gate 不展示选项

- **WHEN** Phase 2 到达 affinity_gate
- **THEN** SHALL 不调用 AskUserQuestion，直接转场

### Requirement: state route 命令

`state route <script-id> <gate-scene-id>` SHALL 读取状态并评估 gate 的 routing conditions。

#### Scenario: 成功路由

- **WHEN** 执行 `state route script-001 scene-gate`
- **THEN** SHALL 输出 `ROUTE <route_id> → <next-scene-id>` 并在 meta.yaml 写入 `current_route`

#### Scenario: gate 场景不存在

- **WHEN** 指定的 gate scene-id 不存在
- **THEN** SHALL 报错

### Requirement: endings 路线归属

每个 ending SHALL 有 `route` 字段标记归属路线。Phase 2 评估 ending 时只考虑 `route == current_route` 的 endings。

#### Scenario: 只评估当前路线的 endings

- **WHEN** 玩家在 kiritsugu-route，到达路线末尾
- **THEN** SHALL 只评估 `route: "kiritsugu-route"` 的 endings

#### Scenario: 每条路线有 default ending

- **WHEN** 路线内没有条件满足
- **THEN** SHALL 命中该路线的 `condition: "default"` ending

### Requirement: plan 验证 gate 和路线

`state script plan` SHALL 验证 gate 场景和路线结构。

#### Scenario: gate routing 必须有 default

- **WHEN** gate 的 routing 最后一条不是 `condition: "default"`
- **THEN** SHALL 报错

#### Scenario: 每条路线至少有 1 个 ending

- **WHEN** 某条路线没有对应 ending
- **THEN** SHALL 报错

#### Scenario: routing next 指向有效路线场景

- **WHEN** gate routing 的 next 指向不存在的场景
- **THEN** SHALL 报错

#### Scenario: 路线场景数平衡

- **WHEN** 路线间场景数差距超过 2
- **THEN** SHALL 警告（不阻塞）

### Requirement: 分支树路线着色

tree-server SHALL 返回路线信息，HTML 按路线着色节点和边。

#### Scenario: 不同路线不同颜色

- **WHEN** 浏览器打开分支树
- **THEN** 共通线节点白色，各路线节点不同颜色，gate 节点菱形

#### Scenario: gate 节点特殊渲染

- **WHEN** 场景类型为 affinity_gate
- **THEN** SHALL 渲染为菱形而非矩形
