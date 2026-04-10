## ADDED Requirements

### Requirement: Step cap 基于角色数动态扩展
Export agent 的 `stopWhen` step cap SHALL 根据 preSelected.souls 的角色数动态计算，而非固定的魔法数字。公式 SHALL 为：`minimalSteps + safetyBuffer`，其中 `minimalSteps = STEP_SETUP_BASELINE + characterCount × STEP_PER_CHARACTER + STEP_FINALIZE`，`safetyBuffer = max(5, characterCount)`。

`STEP_SETUP_BASELINE = 3`（对应 set_story_metadata + set_story_state + set_prose_style 三个必需 setup 调用）、`STEP_PER_CHARACTER = 2`（对应 add_character + set_character_axes）、`STEP_FINALIZE = 1`（对应 finalize_export）。这三个常量 SHALL 定义在 export-agent.ts 顶部，带 JSDoc 说明每个数字对应的 tool 名。未来工作流扩展新 setup 工具时必须同步更新对应常量。

#### Scenario: 4 角色 skill step cap
- **WHEN** `computeExportStepCap(4)` 被调用
- **THEN** 返回 `17`（`minimalSteps = 3 + 4×2 + 1 = 12`, `safetyBuffer = max(5, 4) = 5`）

#### Scenario: 9 角色 skill step cap
- **WHEN** `computeExportStepCap(9)` 被调用
- **THEN** 返回 `31`（`minimalSteps = 3 + 9×2 + 1 = 22`, `safetyBuffer = max(5, 9) = 9`）

#### Scenario: 2 角色 skill step cap
- **WHEN** `computeExportStepCap(2)` 被调用
- **THEN** 返回 `13`（`minimalSteps = 3 + 2×2 + 1 = 8`, `safetyBuffer = max(5, 2) = 5`）

#### Scenario: 1 角色 skill step cap
- **WHEN** `computeExportStepCap(1)` 被调用
- **THEN** 返回 `11`（`minimalSteps = 3 + 1×2 + 1 = 6`, `safetyBuffer = max(5, 1) = 5`）

### Requirement: Step cap 错误消息明确耗尽原因
当 export agent 因 step cap 耗尽而终止（即 `stepCountIs(cap)` 条件触发而非 `hasToolCall('finalize_export')`），错误消息 SHALL 明确指出 "达到 step 上限（N 步，M 角色）"，并显示已成功注册的角色数。这让用户能区分 "step cap 配置不够" 与 "LLM 因其他原因未完成"。

#### Scenario: Step cap 耗尽时的错误消息
- **WHEN** export agent 达到 step cap 但未调用 finalize_export
- **AND** 实际步数 ≥ step cap
- **THEN** 错误消息 SHALL 包含 "达到 step 上限"
- **AND** 错误消息 SHALL 包含 step cap 数值（如 "20 步"）
- **AND** 错误消息 SHALL 包含角色总数（如 "9 角色"）
- **AND** 错误消息 SHALL 包含已注册角色数（如 "已注册 6/9 个角色"）

#### Scenario: 非 step-cap 原因终止的错误消息
- **WHEN** export agent 在达到 step cap 之前就停止（LLM 主动或其他错误）
- **AND** finalize_export 未被调用
- **THEN** 错误消息 SHALL 不包含 "达到 step 上限" 字样
- **AND** 错误消息 SHALL 保留原有 "未调用 finalize_export" 描述

## MODIFIED Requirements

### Requirement: System prompt 引导分阶段调用
Export Agent 的 SYSTEM_PROMPT SHALL 明确指引 agent 按 set_story_metadata → set_story_state → set_prose_style → add_character + set_character_axes (per character) → finalize_export 的顺序调用工具。SYSTEM_PROMPT 中 SHALL 包含 §3.5「叙事风格锚点决策」章节，引导 agent 根据 world manifest + characters 推断本故事的 prose style，并从通用反例库选择 ≥ 3 条 forbidden_patterns，自己现编 ≥ 3 条 ip_specific 规则。

tool-loop 的 `stopWhen` SHALL 配置 `stepCountIs(computeExportStepCap(characterCount))` 而非硬编码数字，让 step cap 随角色数扩展。

#### Scenario: Prompt 包含 6 步工作流说明
- **WHEN** 构造 SYSTEM_PROMPT
- **THEN** SHALL 包含 6 步顺序：set_story_metadata → set_story_state → set_prose_style → add_character → set_character_axes → finalize_export
- **AND** SHALL 强调每次调用 input 简短
- **AND** SHALL 说明遇到 error 应根据信息修正后重试

#### Scenario: Prompt §3.5 章节
- **WHEN** 构造 SYSTEM_PROMPT
- **THEN** SHALL 含「叙事风格锚点决策」章节
- **AND** SHALL 说明 voice_anchor 必须含具体 IP 类型词
- **AND** SHALL 说明 ip_specific 至少 3 条具体规则（拒绝抽象描述）
- **AND** SHALL 说明何时为角色提供 voice_summary（非目标语言占比 > 30%）

#### Scenario: 终止条件使用动态 step cap
- **WHEN** 配置 stopWhen
- **THEN** SHALL 包含 `hasToolCall('finalize_export')` 作为成功终止条件
- **AND** SHALL 包含 `stepCountIs(computeExportStepCap(characterCount))` 作为护栏
- **AND** SHALL 不再硬编码 20 或任何固定数字
