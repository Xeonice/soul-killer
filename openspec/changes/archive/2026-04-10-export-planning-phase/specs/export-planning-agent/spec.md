## ADDED Requirements

### Requirement: Planning Agent 循环

runExportAgent SHALL 在 Execution Agent 之前运行一个独立的 Planning Agent LLM 循环。Planning Agent 接收 soul/world 全文和故事信息，分析后通过 `submit_plan` 工具输出结构化薄 plan。

#### Scenario: Planning Agent 正常完成

- **WHEN** runExportAgent 启动
- **THEN** SHALL 先创建 Planning Agent（独立的 ToolLoopAgent 实例）
- **AND** Planning Agent 的 initial prompt SHALL 包含完整的 soul/world 数据 + storyName + storyDirection
- **AND** Planning Agent 的工具集 SHALL 仅包含 `submit_plan`
- **AND** Planning Agent 的 stopWhen SHALL 为 `[stepCountIs(5), hasToolCall('submit_plan')]`
- **AND** Planning Agent 成功调用 submit_plan 后 SHALL 结束循环并返回 plan 数据

#### Scenario: Planning Agent 失败

- **WHEN** Planning Agent 的 step cap（5 步）耗尽且 submit_plan 未成功调用
- **THEN** SHALL 发出 error 事件
- **AND** SHALL 不启动 Execution Agent
- **AND** 错误消息 SHALL 包含 "规划失败" 字样

### Requirement: submit_plan 工具

Planning Agent SHALL 拥有 `submit_plan` 工具用于提交结构化执行计划。

#### Scenario: submit_plan 接受合法 plan

- **WHEN** Planning Agent 调用 `submit_plan` 且所有校验通过
- **THEN** SHALL 返回 `{ ok: true, confirmed_plan: <plan> }`

#### Scenario: submit_plan schema

- **WHEN** Planning Agent 调用 `submit_plan`
- **THEN** 参数 SHALL 包含以下字段：
  - `genre_direction: string`（非空）
  - `tone_direction: string`（非空）
  - `shared_axes: [string, string]`（恰好 2 个 snake_case 标识符）
  - `flags: string[]`（非空，每项 snake_case）
  - `prose_direction: string`（非空）
  - `characters: ExportPlanCharacter[]`

#### Scenario: ExportPlanCharacter schema

- **WHEN** characters 数组中的每个元素
- **THEN** SHALL 包含：
  - `name: string`（必须匹配 preSelectedSouls 中的某个名称）
  - `role: 'protagonist' | 'deuteragonist' | 'antagonist'`
  - `specific_axes_direction: string[]`（0-2 个自然语言方向描述）
  - `needs_voice_summary: boolean`
- **AND** 可选字段：
  - `appears_from?: number`（从第几幕出场）
  - `shared_initial_overrides_hint?: Record<string, number>`（共享轴初始值偏离提示）

### Requirement: submit_plan 程序校验

submit_plan 的 execute 函数 SHALL 对提交的 plan 进行结构化校验，失败时返回 `{ error }` 以允许 LLM 修正重试。

#### Scenario: 角色覆盖校验

- **WHEN** submit_plan 的 characters 列表中的 name 集合与 preSelectedSouls 不完全匹配
- **THEN** SHALL 返回 `{ error }` 并指出缺失或多余的角色名

#### Scenario: shared_axes 校验

- **WHEN** shared_axes 不是恰好 2 个元素
- **OR** 任一元素不是 snake_case
- **THEN** SHALL 返回 `{ error }`

#### Scenario: protagonist 校验

- **WHEN** 没有任何 character 的 role 为 protagonist
- **THEN** SHALL 返回 `{ error: "至少需要 1 个 protagonist" }`

#### Scenario: flags 校验

- **WHEN** flags 为空数组
- **OR** 任一 flag 不是 snake_case
- **THEN** SHALL 返回 `{ error }`

#### Scenario: 必填字段校验

- **WHEN** genre_direction 或 tone_direction 或 prose_direction 为空字符串
- **THEN** SHALL 返回 `{ error }`

### Requirement: Planning Agent system prompt

Planning Agent SHALL 拥有独立的 PLANNING_SYSTEM_PROMPT，引导 LLM 分析 soul/world 数据并输出结构化 plan。

#### Scenario: prompt 内容

- **WHEN** 构造 PLANNING_SYSTEM_PROMPT
- **THEN** SHALL 包含角色关系分析指引（交叉提取、禁止编造）
- **AND** SHALL 包含 role 分配指引（至少 1 个 protagonist）
- **AND** SHALL 包含 shared_axes 设计指引（2 个非 bond 轴）
- **AND** SHALL 包含 flags 设计指引（关键事件转折点）
- **AND** SHALL 包含资料使用守则（只用提供的数据，禁止训练数据补充）
- **AND** SHALL 说明输出的 plan 将展示给用户确认

### Requirement: Planning Agent step cap

Planning Agent 的 step cap SHALL 固定为 5 步（1 次 submit_plan + 4 次重试缓冲），不随角色数动态调整。

#### Scenario: Planning Agent step cap 值

- **WHEN** 构造 Planning Agent 的 stopWhen
- **THEN** stepCountIs 参数 SHALL 为 5

### Requirement: Planning Agent 进度事件

Planning Agent 运行期间 SHALL 通过 onProgress 回调发送进度事件。

#### Scenario: phase 事件

- **WHEN** Planning Agent 启动
- **THEN** SHALL 发送 `{ type: 'phase', phase: 'planning' }`

#### Scenario: tool 事件

- **WHEN** Planning Agent 调用 submit_plan
- **THEN** SHALL 发送 `tool_start` 和 `tool_end` 事件
- **AND** tool_end 的 result_summary SHALL 包含角色数和 protagonist 名称
