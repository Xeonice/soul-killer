## Why

项目的 i18n 系统只覆盖了 CLI 用户界面层，且仍有 ~22 处硬编码中文遗漏。更关键的是，整个导出层（export）、Agent/Distill 层的 LLM prompt、以及维度定义全部硬编码中文。当用户选择日语或英语时，导出的 .skill 文件仍然生成中文内容，这与多语言承诺不符。需要一次全面的 i18n 改造，使语言选择贯穿从 CLI 到导出产物的完整链路。

## What Changes

### CLI 层
- 清理 7 个文件中 ~22 处硬编码中文运行时字符串，全部迁移到 `t()` + locale JSON
- 补齐 en.json / ja.json 对应 key

### Export 层（核心改动）
- **双层模板架构**: SKILL.md 引擎指令层重写为英文（lingua franca），叙事指令层按 `target_language` 动态生成
- **Agent prompts 多语言化**: planning/execution system prompt 翻译为 en/ja 版本，运行时按语言选择
- **story-spec.ts 多语言化**: 结构标签和说明文档按语言生成
- **Prose style 扩展**: 新增 `ja-translatese-patterns.ts`（日语反翻译腔模式库）；英语无需 anti-translatese

### Agent/Distill 层
- `soul-dimensions.ts` / `world-dimensions.ts`: 维度名、描述、信号词、质量标准全部多语言化
- `planning-agent.ts`: 分类策略、搜索规则、错误消息多语言化
- `distill-agent.ts`: 蒸馏工作流指南多语言化
- `world/distill.ts`: 世界条目生成/历史过滤规则多语言化

### State Runtime
- `runtime/lib/*.ts` 中 CLI 输出消息（给 LLM 读取）跟随导出语言

## Capabilities

### New Capabilities
- `export-i18n`: 导出层双层模板架构 — 引擎指令英文化 + 叙事层按目标语言动态生成，包括 SKILL.md、story-spec、agent prompts
- `prompt-i18n`: Agent/Distill 层 LLM prompt 多语言支持 — 维度定义、搜索策略、蒸馏指南按语言切换
- `prose-style-multilingual`: Prose style 系统扩展 — 日语 anti-translatese pattern 库

### Modified Capabilities
- `i18n`: 补全 CLI 层遗漏的硬编码中文，确保 100% t() 覆盖

## Impact

- **src/export/spec/skill-template.ts** — 最大改动，913 行中文引擎指令需重构为英文 + 叙事层模板化
- **src/export/agent/prompts.ts** — 335 行 prompt 需 en/ja 翻译版本
- **src/export/spec/story-spec.ts** — 208 行结构标签多语言化
- **src/infra/i18n/locales/*.json** — 新增 key（CLI 遗漏 + prompt 模板）
- **src/soul/capture/soul-dimensions.ts** / **src/world/capture/world-dimensions.ts** — 维度定义多语言化
- **src/export/support/zh-translatese-patterns.ts** — 保持不变，新增 ja 版本
- **src/export/state/*.ts** — 输出消息国际化
- **测试**: 现有 vitest 单元测试和 E2E 测试需验证多语言路径
