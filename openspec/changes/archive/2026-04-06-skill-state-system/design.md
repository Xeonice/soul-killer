## Context

导出的 Cloud Skill 在 Cloud 端运行时，由 Claude 根据 story-spec.md 动态生成视觉小说剧本，然后按 SKILL.md 的规则运行故事。所有状态追踪都发生在 Claude 的对话上下文中——没有持久化存储，纯 prompt 驱动。

当前 story-spec.md 只定义了场景结构和选项跳转，没有状态累积机制。SKILL.md 的场景流转规则只处理选项→下一场景的跳转。

## Goals / Non-Goals

**Goals:**
- 每个选项对隐藏状态产生累积影响
- 结局由累积状态决定，而非最后一个分支选择
- 结局展示包含旅程回顾 + 其他可能结局 + 重玩入口
- 状态系统在 Cloud 端由 LLM 生成和维护，不需要导出端代码逻辑

**Non-Goals:**
- 不做实时状态 UI 展示（状态对玩家隐式）
- 不做状态持久化（重玩时完全重置）
- 不改动 Export Agent 或 packager 逻辑

## Decisions

### Decision 1: 混合状态模型（数值轴 + 事件标记）

**选择**: 2-3 个数值轴（范围 0-10，初始 5）+ 3-5 个布尔事件标记

**替代方案 A**: 纯数值轴 — 太机械，缺少叙事关键节点的表达
**替代方案 B**: 纯叙事标签 — 难以做精确的条件判定

**理由**: 数值轴表达渐变的关系变化（信任慢慢建立），事件标记表达二元的关键节点（是否分享了秘密）。两者组合能覆盖视觉小说的典型结局判定模式。

### Decision 2: 状态由 Cloud 端 LLM 自行维护

**选择**: SKILL.md 指示 Claude 在内部上下文中维护状态对象，不输出给用户

**替代方案**: 在 story-spec.md 中预定义完整的状态表

**理由**: story-spec.md 只定义"规约"（需要什么轴、什么标记、怎么影响），具体的轴名称和标记名称由 Phase 1 的 LLM 根据 Soul+World 内容自行设计。这和基调推导的思路一致——导出端不硬编码内容，运行端动态生成。

### Decision 3: 结局展示三段式

**选择**: 结局文字 → 旅程回顾（状态可视化 + 事件列表）→ 其他结局预览 → 重玩/结束选项

**理由**: 
- 旅程回顾让玩家看到自己的选择累积了什么，赋予"重量感"
- 其他结局预览创造"下次我要试试不同路线"的动力
- 重玩选项让用户无需重新调用 Skill 就能再来一次

### Decision 4: 重玩回到 Phase 0

**选择**: "从头再来"重置状态，回到 Phase 0（重新询问 seeds）

**替代方案**: 回到 Phase 2 开头（复用同一个剧本）

**理由**: 回到 Phase 0 让用户可以换一个 seed 方向，获得完全不同的故事。如果用同一个剧本重玩，用户已经知道了所有分支，缺乏新鲜感。

### Decision 5: story-spec.ts 的模板变更范围

变更集中在 `generateStorySpec()` 函数输出的 markdown 中追加三个段落：
1. **状态系统** — 数值轴定义规则、事件标记定义规则、选项影响标注格式
2. **结局判定** — 条件格式、优先级规则、默认结局要求
3. **结局展示** — 旅程回顾格式、其他结局预览格式

### Decision 6: skill-template.ts 的模板变更范围

变更集中在 `generateSkillMd()` 输出的 Phase 2 规则中追加：
1. **状态追踪规则** — 维护状态对象、选择后更新、不向用户暴露
2. **结局判定规则** — 到达结局阶段时评估条件
3. **结局展示规则** — 三段式展示 + AskUserQuestion 重玩选项
4. **重玩规则** — 选择"从头再来"时重置状态，回到 Phase 0

### Decision 7: Skill 命名空间前缀 `soulkiller:`

**选择**: 导出的 Skill name 使用 `soulkiller:{soul}-in-{world}` 格式，目录名同步使用 `soulkiller:{soul}-in-{world}`

**替代方案**: 不加前缀，保持 `{soul}-in-{world}`

**理由**: Claude Code 的 Skill 命名空间使用冒号分隔（如 `opsx:explore`、`figma:figma-use`）。Soulkiller 导出的 Skill 需要统一的命名空间来区分来源，避免与用户其他 Skill 冲突。用户调用时输入 `/soulkiller:v-in-cyberpunk-2077`，清晰标识这是 Soulkiller 导出的视觉小说。

**影响范围**:
- `skill-template.ts` — SKILL.md frontmatter 的 `name` 字段加前缀
- `packager.ts` — `getSkillDirName()` 输出加前缀（目录名）
- `export-agent.ts` — 完成事件的 `skill_name` 加前缀

## Risks / Trade-offs

- **[LLM 状态追踪可靠性]** Claude 在长对话中可能"忘记"更新状态 → 缓解：SKILL.md 中以强约束要求每次选择后必须更新，并在结局阶段前强调"回顾所有状态变更"
- **[状态系统质量]** Phase 1 生成的状态轴和事件标记质量取决于 LLM 理解 → 缓解：story-spec.md 规约中给出具体示例和约束（如"轴名称必须反映 Soul 人格特征"）
- **[结局条件覆盖]** LLM 可能生成互相矛盾或遗漏的条件 → 缓解：规约要求"最后一个结局必须是无条件默认结局"
