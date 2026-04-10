## 1. CLI 层硬编码清理

- [x] 1.1 提取 `world-distill-panel.tsx` 4 处硬编码中文（数据摄入/维度分类/语义聚类/条目生成）到 locale JSON，使用 `t()`
- [x] 1.2 提取 `world-distill-review.tsx` 6 处硬编码中文（审查完成/无条目/时间标签/警告/接受/跳过/结束按钮）到 locale JSON
- [x] 1.3 提取 `export.tsx` 5 处硬编码中文（无法读取 soul/world、配置未初始化、按 Enter 返回）到 locale JSON
- [x] 1.4 提取 `create.tsx` 1 处硬编码中文（tag placeholder "INTJ 话少 冷幽默 技术洁癖"）到 locale JSON
- [x] 1.5 提取 `config.tsx` 4 处硬编码中文（中文/日本語 语言标签、SearXNG 描述）到 locale JSON
- [x] 1.6 提取 `export-protocol-panel.tsx` 2 处硬编码中文（已输入标签、角色摘要）到 locale JSON
- [x] 1.7 补齐 en.json / ja.json 中新增 key 的翻译

## 2. 维度定义多语言化

- [x] 2.1 重构 `soul-dimensions.ts`：display/description/qualityCriteria 改为 `Record<SupportedLanguage, string>`，添加 en/ja 翻译
- [x] 2.2 重构 `world-dimensions.ts`：display/description/qualityCriteria/META_EXCLUSION_CRITERION 改为 `Record<SupportedLanguage, string>`，添加 en/ja 翻译
- [x] 2.3 更新所有引用维度 display/description/qualityCriteria 的调用点，传入当前语言

## 3. Agent/Distill Prompt 多语言化

- [x] 3.1 `planning-agent.ts`：分类策略、搜索规则、质量标准、错误消息改为 `Record<SupportedLanguage, string>` 索引，添加 en/ja 版本
- [x] 3.2 `distill-agent.ts`：系统 prompt 中的行为指南、关系类型等中文段落改为按语言参数化，添加 en/ja 版本
- [x] 3.3 `world/distill.ts`：世界条目生成 prompt、历史过滤规则、Pass C 分析 prompt 改为按语言参数化，添加 en/ja 版本
- [x] 3.4 `capture-agent.ts`：评分示例改为按语言参数化
- [x] 3.5 更新 agent/distill 调用链，将 language 参数从 config 透传到各 prompt 函数

## 4. Export 层双层模板重构

- [x] 4.1 `skill-template.ts` 引擎指令层（Phase 控制流、state 管理、validation、save/load）重写为英文
- [x] 4.2 `skill-template.ts` 叙事指令层（prose style、禁止事项、场景渲染规则、选项文本规则）提取为按 language 参数化的模板，编写 zh/en/ja 三语版本
- [x] 4.3 `skill-template.ts` 函数签名增加 `language: SupportedLanguage` 参数，更新所有调用点
- [x] 4.4 `story-spec.ts` 结构标签和说明文档按语言生成，编写 zh/en/ja 三语版本
- [x] 4.5 `story-spec.ts` 函数签名增加 `language` 参数，更新所有调用点

## 5. Export Agent Prompt 多语言化

- [x] 5.1 `prompts.ts` PLANNING_SYSTEM_PROMPT 改为 `Record<SupportedLanguage, string>`，编写 en/ja 版本
- [x] 5.2 `prompts.ts` EXECUTION_SYSTEM_PROMPT 改为 `Record<SupportedLanguage, string>`，编写 en/ja 版本
- [x] 5.3 导出 `getPlanningPrompt(lang)` / `getExecutionPrompt(lang)` 函数，更新调用点

## 6. Prose Style 多语言扩展

- [x] 6.1 新建 `src/export/support/ja-translatese-patterns.ts`，编写日语反翻译腔模式库
- [x] 6.2 `formatPatternsForToolDescription()` 增加 language 参数，zh 返回中文 patterns，ja 返回日语 patterns，en 返回空或英文 prose guidance
- [x] 6.3 更新 `set_prose_style` 工具描述和调用点，传入 language

## 7. State Runtime CLI 消息国际化

- [x] 7.1 提取 `runtime/lib/*.ts` 中所有 LLM 可读的输出消息字符串为顶部常量对象
- [x] 7.2 为消息常量编写 en/ja 版本
- [x] 7.3 `packager.ts` 中 `injectRuntimeFiles()` 根据 export language 注入对应语言的消息常量

## 8. 语言参数传递链路

- [x] 8.1 `ExportCommand` 从 config 读取 language 并传递给 planning/execution agent
- [x] 8.2 `ExportBuilder` / `packager` 接收 language 参数并传递给 skill-template / story-spec / runtime 注入
- [x] 8.3 确保 language 参数在整个 export 链路中一致传递（config → command → agent → template → packager）

## 9. 验证

- [x] 9.1 现有单元测试通过（`bun run test`）
- [ ] 9.2 现有 E2E 测试通过（`bun run test:e2e`）（需用户手动验证）
- [ ] 9.3 手动验证：设置 language=en，执行 /export，检查生成的 .skill 文件中引擎指令为英文、叙事指令为英文
- [ ] 9.4 手动验证：设置 language=ja，执行 /export，检查生成的 .skill 文件中引擎指令为英文、叙事指令为日文
- [ ] 9.5 手动验证：设置 language=zh，执行 /export，确认行为与改动前一致（回归）
