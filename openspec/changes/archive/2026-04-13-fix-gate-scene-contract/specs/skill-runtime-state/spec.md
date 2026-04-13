## ADDED Requirements

### Requirement: parseScene 识别 affinity_gate 场景类型

`script.ts` 的 `parseScene` SHALL 检查场景的 `type` 字段，当 `type === "affinity_gate"` 时走 gate 解析路径。

#### Scenario: gate 场景无 choices 字段

- **WHEN** parseScene 解析的场景有 `type: "affinity_gate"` 且无 `choices` 字段
- **THEN** SHALL 默认 `choices` 为空数组 `[]`，不抛出错误

#### Scenario: gate 场景有 choices 空数组

- **WHEN** parseScene 解析的场景有 `type: "affinity_gate"` 且 `choices: []`
- **THEN** SHALL 正常解析，choices 为空数组

#### Scenario: gate 场景保留 routing 字段

- **WHEN** parseScene 解析的场景有 `type: "affinity_gate"` 且含 `routing` 数组
- **THEN** 返回的 ScriptScene SHALL 包含 `routing` 字段，原样保留 routing 内容

#### Scenario: 普通场景行为不变

- **WHEN** parseScene 解析的场景无 `type` 字段或 `type !== "affinity_gate"`
- **THEN** SHALL 保持现有行为：`choices` 必须为数组否则抛出错误

### Requirement: ScriptScene 类型扩展

ScriptScene 接口 SHALL 新增可选字段以支持 gate 场景。

#### Scenario: ScriptScene 包含 gate 字段

- **WHEN** TypeScript 代码使用 ScriptScene 类型
- **THEN** SHALL 可选地包含 `type?: string`、`routing?: ScriptRouting[]`、`route?: string` 字段
