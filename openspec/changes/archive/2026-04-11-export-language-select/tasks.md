## 1. 数据类型

- [x] 1.1 `PreSelectedExportData` (types.ts) 新增 `exportLanguage: SupportedLanguage` 字段
- [x] 1.2 语言名映射工具函数：`buildLanguageDirective(lang)` + `LANGUAGE_NAMES` 常量

## 2. Export Wizard 语言选择步骤

- [x] 2.1 `export.tsx` UIStep 新增 `'selecting-language'`
- [x] 2.2 在 `story-direction` → `selecting-output` 之间插入语言选择步骤（↑↓ 选择，Enter 确认）
- [x] 2.3 默认选中 `config.language`（通过 `getLocale()`），存入 state
- [x] 2.4 将选中的语言赋值到 `preSelected.exportLanguage`
- [x] 2.5 locale JSON 新增 `export.step.select_language` i18n key（zh/en/ja）

## 3. Agent Prompt 语言指令注入

- [x] 3.1 `buildInitialPrompt()` / `buildPlanningPrompt()` / `buildStorySetupPrompt()` 注入 `buildLanguageDirective(exportLanguage)` 到 prompt 开头
- [x] 3.2 语言指令包含 target_language 提示和全文输出语言要求
- [x] 3.3 中文（zh）时不注入指令（保持现有行为）
- [x] 3.4 更新 `buildExecutionPrompt()` — 继承自 `buildInitialPrompt()` 已自动包含

## 4. Prose Style Pattern 库语言感知

- [x] 4.1 `makeStorySetupTools()` 接收 `exportLanguage` 参数
- [x] 4.2 `formatPatternsForToolDescription(exportLanguage)` 按语言选择 pattern 库

## 5. 验证

- [x] 5.1 `bun run build` 通过
- [x] 5.2 `bun run test` 全部通过（81 files, 918 tests）
- [ ] 5.3 手动验证：导出时选择 en，确认 story-spec 中 genre/tone/constraints 为英文
- [ ] 5.4 手动验证：导出时选择 ja，确认 story-spec 中 genre/tone 为日文
