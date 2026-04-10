## MODIFIED Requirements

### Requirement: System prompt 引导 reportFindings 调用

SOUL_SYSTEM_PROMPT 和 WORLD_SYSTEM_PROMPT 的 Rules 部分 SHALL 包含显式的 reportFindings 终止约束，确保 `toolChoice: 'auto'` 模式下模型仍然调用该工具。

#### Scenario: Rules 包含终止约束

- **WHEN** 构造 capture agent 的 system prompt
- **THEN** Rules 部分 SHALL 包含 "Your LAST tool call MUST be reportFindings"
- **AND** SHALL 包含 "Text output alone does NOT count as completion"

#### Scenario: buildSystemPrompt 结尾提醒

- **WHEN** buildSystemPrompt 生成带维度列表的 prompt
- **THEN** 结尾 SHALL 包含 "When all dimensions are covered, immediately call reportFindings"
