## Why

观察到生成的 skill 在 Phase 1 实际运行时产生"资料被略读"的症状：剧本单薄、深层 behaviors/*.md 中的细节从不出现、prose_style 约束看起来好像没被遵守。

用真实 skill（`three-kingdom-chibi-in-skill-0003tvip`，9 角色）重跑 Phase -1 → Phase 0，从 Claude Code 的 Read 日志里直接看到证据：

```
Read script-hr5act01.yaml → lines 1-15
Read story-spec.md         → lines 1-50
```

**LLM 在用 Read 工具的 `offset/limit` 参数做分页读取，默认只读每个文件的前 30-50 行**。这不是因为 context 不够（用户使用的是 Claude Opus 4.6 1M context，9 角色 skill 的全部文本 ≈ 100K tokens，只占 10%），而是 LLM 的训练默认行为是"先读头部探情况"。SKILL.md 从来没有明确对抗这个默认行为。

更严重的：**Phase 0 的窄读会污染 Phase 1**。Phase 0 为了拿 `acts_options` 只 Read 了 story-spec.md 的前 50 行，Phase 0 和 Phase 1 共享同一个 Claude 会话，Phase 1 LLM 看到上下文里"story-spec.md 已读"就不会再 Read 一次——而我们刚加的 prose_style 章节、Story State 章节全都在 line 80+ 之后，根本没进入 Phase 1 的上下文。这让 prose-style-anchor change 的效果被直接掏空。

## What Changes

- 改造 SKILL.md 的 Phase 1 创作步骤：在"读数据"阶段明确禁止 `offset/limit` 参数，要求所有 Read 调用全量读取
- Phase 1 prompt 注入**显式的上下文预算授权**："本阶段预计需要 Read 约 N 个文件、约 M KB 文本；你有 1M 上下文窗口，这 < 15%；不要节省，全量读"
- packager 生成 SKILL.md 时计算并注入 **expected_file_count** / **expected_text_size_kb** 两个估算数，作为 Phase 1 prompt 的硬 anchor
- Phase 1 新增 **Step 0: 数据加载报告** —— LLM 必须在进入 Step 1 之前显式输出一个 coverage 报告（列出每个角色读了哪些文件 + 每个文件的行数），soulkiller 模板把报告作为 Step 1 前的硬门槛
- 修 Phase 0 → Phase 1 污染问题：Phase 1 开头加一句 "忽略之前 Phase 0 对 story-spec.md 的部分读取，重新 Read 整个文件"，保证 prose_style / Story State / characters 章节一定进入上下文
- Phase 1 Step 5 新增 **Step 5.h — 数据覆盖完整性自检**：基于 Step 0 的加载报告，验证每个角色的 behaviors/ 文件都被 Read 过，且每个 Read 的行数看起来合理（typical identity.md > 80 行；看到 < 50 行说明中了 limit，必须重 Read）
- 单角色引擎同步更新 Phase 1 Step 5 的对应自检子步骤（在现有 Step 5.a–5.d 后追加 5.e 数据覆盖自检）

### Scope 扩展：Phase 2 LLM trained-default 行为抑制

在 apply 阶段观察到另一类同根源问题：Phase 2 运行时 LLM 会自主插入 "要继续吗？" meta 暂停、暴露存档细节、展示进度指示、在 AskUserQuestion 混入伪菜单选项。与 Phase 1 partial-Read 同属"LLM chatbot 训练默认行为在 visual novel 连续叙事里水土不服"的同一根因类别，一并在本 change 中修复：

- SKILL.md 的「场景流转规则」段新增「你只在 3 种情况下停止渲染」子段，枚举合法停止点
- 「禁止事项」段从一个无结构 bullet list 重构为 5 个分类（剧情结构 / 控制流自暂停 / 进度存档暴露 / 聊天机器人式元叙述 / 选项标签污染），每条规则都指向具体的反例文字
- apply_consequences → 渲染下一场景被声明为"同一个原子动作"，消除 LLM 误解"一次输出多个场景"的歧义
- 多角色和单角色引擎同步修改

## Capabilities

### New Capabilities
- 无

### Modified Capabilities
- `cloud-skill-format`: SKILL.md Phase 1 创作步骤新增 Step 0 数据加载报告 + 全量 Read 约束 + Step 5 数据覆盖自检；packager 生成 SKILL.md 时注入 expected_file_count / expected_text_size_kb
- `export-agent`: packager 层的 file count / text size 估算辅助函数（如果逻辑放在 packager 内，则只影响 cloud-skill-format 这一项）

## Impact

**代码**
- `src/export/skill-template.ts` —— `buildMultiCharacterEngine` 和 `buildSingleCharacterEngine` 的 Phase 1 部分大改；新增 Step 0 输出格式、全量 Read 授权段、Step 5.h / 5.e 自检
- `src/export/packager.ts` —— 新增 `countSkillFiles()` / `estimateSkillTextSize()` 辅助函数，传递给 generateSkillMd
- `src/export/skill-template.ts` 的 `GenerateSkillMdOptions` 接口新增 `expectedFileCount` / `expectedTextSizeKb` 两个可选字段

**API/数据结构**
- generateSkillMd options 扩展（向后兼容：缺字段时不渲染预算 anchor 段）

**依赖**
- 无新增外部依赖

**测试**
- `tests/unit/export.test.ts` 新增断言：SKILL.md 含全量 Read 授权段 / Step 0 加载报告 / Step 5.h 自检
- `tests/unit/export-tools.test.ts` 或 `tests/unit/packager.test.ts` 新增：packager 正确计算 file count / text size 并传递到 generateSkillMd
- manual E2E：用 three-kingdom-chibi 9 角色 skill 在 Claude Code 中重跑 Phase 1，观察 Read 轨迹是否全量读取（无 `lines 1-N` 分页）
