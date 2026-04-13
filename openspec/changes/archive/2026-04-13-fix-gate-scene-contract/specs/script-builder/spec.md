## MODIFIED Requirements

### Requirement: state script scene 验证单个场景

`state script scene <id> <scene-id>` SHALL 读取 `draft/<scene-id>.json` + plan.json，验证后移到 `scenes/`。

#### Scenario: 合法场景

- **WHEN** draft JSON 合法且 consequences keys 存在于 schema 且 predecessors 已就绪
- **THEN** SHALL 移动到 `scenes/<scene-id>.json`，输出 `SCENE_OK`

#### Scenario: consequences 引用不存在的 key

- **WHEN** consequences 中有 schema 不存在的 key
- **THEN** SHALL 报错指明无效 key

#### Scenario: predecessors 未就绪

- **WHEN** scene-004 的 predecessors 包含 scene-003 但 scenes/scene-003.json 不存在
- **THEN** SHALL 报错（违反拓扑序）

#### Scenario: JSON 语法错误

- **WHEN** draft JSON 语法不合法
- **THEN** SHALL 报错输出解析错误位置

#### Scenario: gate 场景自动补全结构字段

- **WHEN** plan 中 scene-id 的 `type === "affinity_gate"`
- **THEN** SHALL 从 plan 拷贝 `type: "affinity_gate"` 和 `routing` 到最终 scene JSON，补全 `choices: []`，忽略 draft 中是否包含这些字段

#### Scenario: gate 场景 draft 只需 text

- **WHEN** gate scene draft JSON 仅包含 `{ "text": "..." }`
- **THEN** SHALL 正常通过验证，结构字段由 plan 补全

#### Scenario: route 场景自动注入 route 标签

- **WHEN** plan 有 `routes` 数组，且 scene-id 属于某条 route 的 scenes 列表
- **THEN** SHALL 在最终 scene JSON 中注入 `route: "<route_id>"`

#### Scenario: 无 routes 的 plan 不注入

- **WHEN** plan 没有 `routes` 字段或 routes 为空
- **THEN** SHALL 不注入 `route` 字段，行为与现有一致
