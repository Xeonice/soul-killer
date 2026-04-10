## Why

目前 export 出来的所有 skill 在 Phase 2 运行时都存在"翻译腔中文"问题——结构上是英文/日文的字面投影，比如 "X 收紧到 Y 的程度"、"让自己的视线和...持平"、"我的 A。我的 B。我的 C。"、"她小小的身体"。这是 **每一个 export 产物的通病**，只是在源数据语言异质的 IP（fsn 间桐桜是最明显的例子）上更容易暴露；语言较纯的 IP（三国）也只是症状轻一些，本质问题相同。

根本原因是整条管线没有任何"目标语言/叙事风格"决策点：

1. distill 阶段按源数据多数语言写 style.md，没有目标语言意识
2. style.md 是 wiki 式元描述（"她说话方式带有...傲娇..."），不提供可模仿的中文叙事样本
3. SKILL.md 模板（grep 全文）没有任何中文写作质量约束
4. Phase 1/2 LLM 完全跑在自身默认中文上，而 LLM 的默认中文带强烈的翻译腔倾向

需要在 export 阶段引入一个"叙事风格锚点"决策层，**作为所有 export 的强制环节**：由 export agent 基于 world + characters 上下文一次性决定本故事的 prose style，并把通用翻译腔反例库注入决策上下文，让下游 Phase 1/2 拿到结构化硬约束而不是抽象指引。目标是 **所有未来 export 出的 skill、所有 IP、所有角色，都不再产生可识别的翻译腔**。

## What Changes

- 新增 `set_prose_style` 工具，加入 export agent 5 步工作流（在 `set_story_state` 之后、`add_character` 之前），形成 6 步流程
- 新增 `ProseStyle` 数据结构：`target_language` / `voice_anchor` / `forbidden_patterns` / `ip_specific` / 可选 `character_voice_summary`
- 新增 `src/export/prose-style/zh-translatese-patterns.ts` —— 通用中文翻译腔反例库（硬编码 8 类常见模式，每条含 bad / good 对照 + 理由）
- 通用反例库 inline 到 `set_prose_style` 工具 description，让 export agent 在做决策时直接看到完整症状学
- 扩展 `StorySpecConfig` / `StoryMetadata`，加 `prose_style: ProseStyle` 字段
- `story-spec.ts` 新增「叙事风格」章节序列化（machine-parseable yaml fenced block）
- `skill-template.ts` 的 Phase 1 创作步骤和 Phase 2 场景呈现规则均引用 prose_style：Phase 1 写 narration/dialogue 时遵守，Phase 2 即兴时把 forbidden_patterns 当硬约束
- export agent system prompt 工作流从 5 步改 6 步，新增 §3.5 章节解释 prose_style 决策原则
- export agent 在 `set_prose_style` 调用前扫描每个角色的 style.md，检测非目标语言含量；若超过阈值，让 LLM 在工具调用 input 中提供 `character_voice_summary` 摘要（中文中性概括，不替代 style.md）
- distill 流程**不变**——所有决策推到 export 阶段

## Capabilities

### New Capabilities
- `prose-style-anchor`: 故事级叙事风格锚点系统。在 export 阶段由 LLM 决定本故事的 target_language / voice_anchor / forbidden_patterns / ip_specific，把"中文翻译腔反例库"作为 export agent 的决策上下文，下游 Phase 1/2 引用 prose_style 作为 narration/dialogue 写作硬约束。

### Modified Capabilities
- `export-agent`: 工作流从 5 步扩展到 6 步，新增 `set_prose_style` 工具调用顺序约束
- `cloud-skill-format`: SKILL.md Phase 1 创作步骤和 Phase 2 场景呈现规则新增 prose_style 引用条款

## Impact

**代码**
- `src/agent/export-agent.ts` —— 新增 `setProseStyle` builder 方法 + `set_prose_style` 工具 + system prompt §3.5
- `src/export/story-spec.ts` —— `ProseStyle` interface + `StorySpecConfig.prose_style` + `formatProseStyleSection`
- `src/export/skill-template.ts` —— Phase 1/2 prompt 引用 prose_style 章节
- `src/export/prose-style/zh-translatese-patterns.ts` —— 新文件，通用反例库
- `src/export/prose-style/index.ts` —— 导出 prose_style 序列化辅助

**API/数据结构**
- `StorySpecConfig` 新增可选 `prose_style` 字段（向后兼容：旧 export 不带该字段时模板使用通用 fallback）
- export agent CharacterDraft 不变；prose_style 是故事级而非角色级

**依赖**
- 无新增外部依赖

**测试**
- `tests/unit/export-builder.test.ts` 新增 setProseStyle 校验测试
- `tests/unit/export.test.ts` 新增 prose_style 序列化和 SKILL.md 引用断言
- `tests/unit/prose-style-patterns.test.ts` 新建，覆盖通用反例库结构
