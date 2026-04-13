## ADDED Requirements

### Requirement: state script plan 验证并补全叙事蓝图

`state script plan <id>` SHALL 读取 `.build-<id>/plan.json`，验证结构，自动计算 predecessors / is_convergence / generation_order 并写回。

#### Scenario: 合法 plan

- **WHEN** plan.json 包含合法的 schema、scenes（每个含 outline + choices ≤ 2）、endings（只有 intent 无 body）
- **THEN** SHALL 自动补全 predecessors/is_convergence/generation_order，输出 `PLAN_OK`

#### Scenario: 自动计算 predecessors

- **WHEN** scene-004 被 scene-002 和 scene-003 的 choices.next 指向
- **THEN** plan.json 写回后 scene-004 SHALL 有 `predecessors: ["scene-002", "scene-003"]` 和 `is_convergence: true`

#### Scenario: 拓扑排序

- **WHEN** plan 有 15 个 scenes 形成 DAG
- **THEN** generation_order 中每个 scene SHALL 排在其所有 predecessors 之后

#### Scenario: 检测环

- **WHEN** scene graph 存在 scene-A → scene-B → scene-A 的环
- **THEN** SHALL 报错指明环路

#### Scenario: choices 超过 2 个

- **WHEN** 某个 scene 有 3 个 choices
- **THEN** SHALL 报错指明哪个 scene 超限

#### Scenario: 孤立 scene

- **WHEN** 某个 choice.next 指向不存在的 scene-id
- **THEN** SHALL 报错指明断裂的连接

#### Scenario: context_refs 引用不存在

- **WHEN** 某个 scene 的 context_refs 包含不存在的 scene-id
- **THEN** SHALL 报错

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

### Requirement: state script ending 验证单个结局

`state script ending <id> <ending-id>` SHALL 读取 `draft/<ending-id>.json` + plan.json，验证后移到 `endings/`。

#### Scenario: 合法结局

- **WHEN** draft JSON 合法且 condition 引用存在于 schema 且 body 非空
- **THEN** SHALL 移动到 `endings/<ending-id>.json`，输出 `ENDING_OK`

#### Scenario: body 为空

- **WHEN** draft JSON 的 body 为空字符串
- **THEN** SHALL 报错

### Requirement: state script build 合并为最终 script

`state script build <id>` SHALL 合并 plan + scenes + endings 为 `script-<id>.json`，清理 build 目录。

#### Scenario: 全部就绪

- **WHEN** plan 中每个 scene-id 和 ending-id 都有对应文件
- **THEN** SHALL 输出 `BUILD_OK`，最终 JSON 格式和现有 script.json 一致

#### Scenario: 场景缺失

- **WHEN** plan 中有 scene-id 没有对应 scene 文件
- **THEN** SHALL 报错列出缺失 scene-ids

#### Scenario: 结局缺失

- **WHEN** plan 中有 ending-id 没有对应 ending 文件
- **THEN** SHALL 报错列出缺失 ending-ids
