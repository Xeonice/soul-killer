## Why

Export 输出的 .skill 文件内容（genre、tone、constraints、prose_style）始终是中文，无论用户的语言设置是什么。虽然 SKILL.md 引擎层已重写为英文，但 export agent 生成的故事元数据和叙事风格仍默认中文。用户需要在导出时选择目标语言，使导出的 skill 运行时产出对应语言的内容。

## What Changes

- Export wizard 新增"导出语言"选择步骤（在 story-direction 之后、selecting-output 之前）
- 默认值为 `config.language`，用户可以覆盖
- 选中的语言通过 `PreSelectedExportData.exportLanguage` 传入 agent 链路
- Planning/Execution/StorySetup agent prompt 注入语言指令，使 agent 输出对应语言的元数据
- Agent 自动将 `set_prose_style.target_language` 设为用户选择的语言

## Capabilities

### New Capabilities
- `export-language-select`: Export wizard 语言选择步骤 + agent prompt 语言指令注入

### Modified Capabilities
（无）

## Impact

- **src/cli/commands/export/export.tsx** — 新增 `selecting-language` wizard 步骤
- **src/export/agent/types.ts** — `PreSelectedExportData` 新增 `exportLanguage` 字段
- **src/export/agent/prompts.ts** — `buildPlanningPrompt`/`buildExecutionPrompt`/`buildStorySetupPrompt` 注入语言指令
- **src/infra/i18n/locales/*.json** — 新增 `export.step.select_language` 等 key
