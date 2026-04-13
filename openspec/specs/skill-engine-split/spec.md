## ADDED Requirements

### Requirement: engine.md 包含完整引擎指令

`runtime/engine.md` SHALL 包含所有 Phase 执行协议、Save System、DSL 规范和 Prohibited Actions，不包含任何故事特有内容。

#### Scenario: engine.md 是通用的

- **WHEN** 任意两个不同 skill 的 runtime/engine.md 内容
- **THEN** SHALL 完全相同（同一 engine_version 下）

### Requirement: SKILL.md 通过引导语加载 engine.md

SKILL.md SHALL 包含明确的引导指令，要求 LLM 在执行任何 Phase 前先完整读取 `${CLAUDE_SKILL_DIR}/runtime/engine.md`。

#### Scenario: LLM 首先读取 engine.md

- **WHEN** skill 被加载，LLM 读取 SKILL.md
- **THEN** SKILL.md 中的引导语 SHALL 指示 LLM 先 Read `runtime/engine.md`，再执行后续流程

### Requirement: soulkiller.json 版本标识

每个 skill 归档 SHALL 包含 `soulkiller.json`，记录 engine_version（递增整数）和 soulkiller_version（导出/升级时的 CLI 版本）。

#### Scenario: soulkiller.json 内容

- **WHEN** skill 导出或升级完成后
- **THEN** `soulkiller.json` SHALL 包含 `engine_version`、`soulkiller_version`、`exported_at`、`skill_id` 字段
