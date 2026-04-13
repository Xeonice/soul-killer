## MODIFIED Requirements

### Requirement: 导出输出拆分后的三文件格式

`/export` 命令 SHALL 输出拆分后的 skill 归档：SKILL.md（故事内容 + 引导语）、runtime/engine.md（引擎指令）、soulkiller.json（版本标识）。

#### Scenario: 新导出的 skill 包含 engine.md

- **WHEN** 执行 `/export` 导出一个 skill
- **THEN** 输出的归档 SHALL 包含 `runtime/engine.md`（引擎指令）和 `soulkiller.json`（版本标识），SKILL.md 中不包含引擎指令

#### Scenario: 新导出 skill 的 SKILL.md 有引导语

- **WHEN** LLM 读取新导出 skill 的 SKILL.md
- **THEN** SHALL 看到 "Read runtime/engine.md" 的引导指令
