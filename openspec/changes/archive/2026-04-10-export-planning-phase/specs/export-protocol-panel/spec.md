## ADDED Requirements

### Requirement: 双阶段分隔线

ExportProtocolPanel SHALL 在规划阶段和执行阶段之间渲染视觉分隔线，让用户能清楚区分两个阶段。

#### Scenario: 规划阶段标题

- **WHEN** phase 为 planning 且 trail 中有规划相关步骤
- **THEN** SHALL 在 trail 上方渲染分隔线 `── 规划 ──`（使用 DIM 颜色）

#### Scenario: 执行阶段标题

- **WHEN** phase 从 plan_review 切换到 analyzing/configuring
- **THEN** SHALL 在新 trail 上方渲染分隔线 `── 执行 ──`（使用 DIM 颜色）

### Requirement: plan_review ActiveZone

ExportProtocolPanel SHALL 支持 `plan_review` 类型的 ActiveZone，展示 plan 详情和确认交互。

#### Scenario: plan_review 渲染

- **WHEN** activeZone.type 为 'plan_review'
- **THEN** SHALL 展示角色编排表：每行包含角色名、role、specific_axes_direction
- **AND** SHALL 展示 genre_direction 和 tone_direction
- **AND** SHALL 展示 shared_axes 名称
- **AND** SHALL 展示 flags 数量
- **AND** 底部 SHALL 显示 "Enter 继续执行 · Esc 取消"

#### Scenario: plan_review 键盘交互

- **WHEN** activeZone.type 为 'plan_review' 且用户按 Enter
- **THEN** SHALL 触发 onPlanConfirm 回调
- **WHEN** activeZone.type 为 'plan_review' 且用户按 Esc
- **THEN** SHALL 触发 onCancel 回调

### Requirement: plan_review reducePanelEvent 处理

reducePanelEvent SHALL 处理 plan_ready 和 plan_confirmed 事件。

#### Scenario: plan_ready 事件

- **WHEN** 收到 `{ type: 'plan_ready', plan }` 事件
- **THEN** activeZone SHALL 切换为 `{ type: 'plan_review', plan }`

#### Scenario: plan_confirmed 事件

- **WHEN** 收到 `{ type: 'plan_confirmed' }` 事件
- **THEN** plan 摘要 SHALL 移入 trail
- **AND** activeZone SHALL 切换为 `{ type: 'idle' }`

### Requirement: 按角色分组的 trail

执行阶段的 trail SHALL 按角色分组展示，将每个角色的 `add_character` + `set_character_axes` 合并为单行。

#### Scenario: 角色分组渲染

- **WHEN** 执行阶段中 add_character 和 set_character_axes 对同一角色都已完成
- **THEN** trail 中该角色 SHALL 显示为单行：`▓ {角色名} ✓`
- **AND** summary 行 SHALL 合并两个工具的结果，如 `protagonist · axes: [荣誉感, 自我价值感]`

#### Scenario: 角色处理中的子步骤

- **WHEN** 某角色的 add_character 已完成但 set_character_axes 尚未调用
- **THEN** 该角色 SHALL 在活动区显示为进行中
- **AND** SHALL 显示已完成的子步骤，如 `add_character ✓ · set_character_axes...`

#### Scenario: setup 工具不参与角色分组

- **WHEN** tool_end 的 tool 为 set_story_metadata / set_story_state / set_prose_style
- **THEN** SHALL 作为独立 trail entry 展示，不参与角色分组

### Requirement: planning phase idle 显示

当 phase 为 planning 时，idle 状态的活动区 SHALL 显示规划相关的文本。

#### Scenario: planning idle 渲染

- **WHEN** phase 为 'planning' 且 activeZone.type 为 'idle'
- **THEN** SHALL 显示 "规划中" + spinner + 经过秒数（而非 "思考中"）

## MODIFIED Requirements

### Requirement: 进度轨迹（ProgressTrail）

进度轨迹 SHALL 以分阶段列表形式展示已完成的步骤。规划阶段和执行阶段各自独立展示。执行阶段按角色分组，不再使用 > 4 步折叠逻辑。

#### Scenario: 规划阶段 trail

- **WHEN** phase 为 planning 或 plan_review
- **THEN** trail SHALL 展示规划阶段的已完成步骤（submit_plan 等）

#### Scenario: 执行阶段 trail

- **WHEN** phase 为 analyzing / configuring / packaging
- **THEN** trail SHALL 展示：
  - 3 行 setup（metadata / state / prose）各自独立
  - N 行 per-character，每个角色一行（合并 add + axes）
  - 1 行 finalize（如已完成）
- **AND** SHALL 不使用 > 4 步的折叠逻辑
