## Context

Soulkiller 已有 Soul 创建/蒸馏/进化和 World 构建/绑定的完整管线。现有的 Agent 模式（`soul-capture-agent`、`world-capture-agent`）使用 Vercel AI SDK `generateText` + tool calling 驱动自主循环。现有的可视化面板 `SoulkillerProtocolPanel` 支持按 phase 分组展示 tool call 进度。

导出功能需要在 Agent 模式的基础上增加**交互式能力**——Agent 执行过程中穿插用户输入（选择/文本），这是现有 Capture Agent（纯后台运行）不具备的。

导出产物是一个 Claude Code Skill 目录，部署到 `.claude/skills/` 后可在 Cloud 中运行。Skill 运行时无法访问 Soulkiller CLI，因此导出物必须自包含。

## Goals / Non-Goals

**Goals:**
- Agent 驱动的导出流程，LLM 控制流程推进，灵活应对各种用户场景
- 导出产物为自包含的 Claude Code Skill 目录，可直接复制到 `.claude/skills/` 使用
- 导出的 Skill 在运行时动态生成视觉小说剧本（由 Cloud 端强模型完成）
- 视觉小说交互使用 AskUserQuestion 呈现选项，幕间使用反思性选择过渡
- 可视化面板支持 Agent 进度与用户交互交替展示

**Non-Goals:**
- 不实现 Skill 的远程发布/分发/marketplace（仅本地导出）
- 不实现 Cloud 端的向量搜索或 RAG（Skill 是纯 prompt 驱动的角色扮演）
- 不修改现有 SoulkillerProtocolPanel（新建独立面板）
- 不在导出时生成完整剧本（剧本在 Skill 运行时由 Cloud 模型动态生成）

## Decisions

### Decision 1: Agent 驱动 vs 固定向导

**选择**: Agent 驱动（tool calling loop）

**替代方案**: 固定 step 状态机向导（如 `world-create-wizard`）

**理由**: 导出流程中有一步需要 LLM 参与（读取 Soul+World 后推导适配的基调选项），且 Agent 模式天然支持灵活交互——如只有一个 Soul 时跳过选择、Soul 与 World 调性冲突时主动提醒、用户想要未列出的风格时自由对话。固定向导无法优雅处理这些边缘情况。

### Decision 2: 剧本在运行时动态生成

**选择**: 导出物包含 story-spec.md（剧本生成规约），Skill 运行时由 Cloud 模型生成完整剧本

**替代方案**: 导出时由用户模型生成完整 story.md 并内置

**理由**: 
- 视觉小说剧本是 Skill 的核心体验，质量直接决定用户感受
- Cloud 端模型通常更强，生成质量天花板更高
- 每次运行生成不同故事，提供可重玩性
- 导出流程更轻量（不需要等待剧本生成 + 预览 + 确认/重做循环）

### Decision 3: story-spec.md 的基调选项由 LLM 推导

**选择**: Export Agent 读取 Soul 人格文件和 World 条目后，由 LLM 推导出 3-4 个适配的基调选项供用户选择

**替代方案**: 提供通用基调列表（悬疑/温情/冒险/恐怖）

**理由**: 通用列表无法反映 Soul + World 组合的独特性。V + 赛博朋克 2077 应该推导出「赛博朋克黑色电影」「义体迷途」等专属选项，而不是通用的"悬疑"。这正是 Agent 模式的优势——LLM 在流程中做有价值的推理。

### Decision 4: Skill 中使用 AskUserQuestion 呈现选项

**选择**: SKILL.md 中指示 Claude 使用 AskUserQuestion 工具呈现视觉小说选项

**替代方案**: 用 markdown 编号文本模拟选项

**理由**: AskUserQuestion 提供原生的交互式选择 UI（上下箭头 + Enter），体验远优于纯文本编号。SKILL.md 通过 prompt 指示 Claude 使用该工具即可，无需额外 API。

### Decision 5: 幕间过渡使用反思性选择

**选择**: Act 切换时输出过渡旁白 + 通过 AskUserQuestion 呈现反思性选择（不影响剧情走向，影响下一幕开场情绪）

**替代方案 A**: 纯文本分隔（无停顿感）
**替代方案 B**: 单选项「继续」按钮（交互无意义）

**理由**: 反思性选择同时解决两个问题——制造幕间停顿感，以及让用户在故事推进中保持「代入感」。

### Decision 6: Story Seeds 在 Skill 运行时由用户提供

**选择**: story-spec.md 中预留 seeds 机制，Skill 运行时 Phase 0 通过 AskUserQuestion 询问用户是否提供剧情种子

**替代方案**: 导出时由导出者固定 seeds

**理由**: Seeds 是个性化体验的一部分，应该由最终用户（Skill 的使用者）决定，而非导出者。同一个 Skill 配合不同 seeds 可以产出完全不同方向的故事。

### Decision 7: ExportProtocolPanel 独立于 SoulkillerProtocolPanel

**选择**: 新建 `ExportProtocolPanel` 组件

**替代方案**: 扩展现有 `SoulkillerProtocolPanel`

**理由**: 两者的交互模式根本不同——SoulkillerProtocolPanel 是纯展示（用户不交互），ExportProtocolPanel 需要在 Agent 进度和用户输入之间交替切换。强行扩展会导致现有组件复杂度爆炸。视觉风格（边框、配色、spinner、▓ 前缀）保持一致。

### Decision 8: Export Agent 的 tool 设计

6 个 tools:

| Tool | 职责 | 输入 | 输出 |
|------|------|------|------|
| `list_souls` | 列出所有已蒸馏的 Soul | 无 | `[{name, display_name, version, soul_type, evolve_count, bound_worlds}]` |
| `list_worlds` | 列出所有 World（标注绑定状态，不过滤） | `{bound_to_soul?}` | `[{name, display_name, world_type, entry_count, is_bound}]` |
| `read_soul` | 读取 Soul 完整内容 | `{name}` | `{manifest, identity, style, behaviors, tags}` |
| `read_world` | 读取 World 完整内容 | `{name}` | `{manifest, entries[{name, meta, content}]}` |
| `ask_user` | 向用户提问 | `{question, options?, allow_free_input?}` | `{answer}` |
| `package_skill` | 打包生成 Skill 目录 | `{soul_name, world_name, story_spec, output_dir?}` | `{output_dir, files}` |

### Decision 9: ExportProtocolPanel 的两区域设计

面板分为**进度轨迹**（上方）和**活动区**（下方）：

- **进度轨迹 (ProgressTrail)**: 已完成步骤的折叠列表。前 3-4 步全部展开，5+ 步后早期步骤折叠为单行摘要（如 `▓ 分身: V · 世界: 赛博朋克 2077 ✓`）
- **活动区 (ActiveZone)**: 当前正在进行的步骤，形态根据 Agent 动作动态切换：
  - Agent 调用 tool → spinner + tool 名称 + 参数摘要
  - Agent 分析思考 → spinner + 分析描述（如「读取 identity.md ✓」「推导适配基调 ⠹」）
  - `ask_user` 选择 → 内嵌选择组件（上下箭头 + Enter）
  - `ask_user` 文本输入 → 内嵌文本输入框 + 已输入列表
  - `package_skill` → 逐步进度（✓/▸/○ 标记各子步骤）
  - 完成 → 结果面板（输出目录结构树）

### Decision 10: Cloud Skill 目录结构与 SKILL.md 模板

```
{soul}-in-{world}/
├── SKILL.md              # 视觉小说引擎 prompt（调度器）
├── soul/
│   ├── identity.md
│   ├── style.md
│   └── behaviors/*.md
├── world/
│   ├── world.json
│   └── entries/*.md
└── story-spec.md          # 剧本生成规约
```

SKILL.md 模板结构：
- frontmatter: name, description, allowed-tools (Read)
- Phase 0: 询问 story seeds（AskUserQuestion）
- Phase 1: 读取 soul/ + world/ + story-spec.md，生成完整视觉小说剧本（内部上下文，不输出）
- Phase 2: 运行故事——场景呈现规则、选项规则（AskUserQuestion）、幕间过渡规则（反思性选择）、世界观补充规则、禁止事项

story-spec.md 模板结构：
- frontmatter: genre, tone, acts, endings_min, rounds
- 剧本生成规约：结构要求、场景格式、叙事约束、角色约束、幕间过渡规则、禁止事项

### Decision 11: 导出物命名规则

格式: `{soul-name}-in-{world-name}`，kebab-case 转换。

- 中文/日文名通过 pinyin/romaji 转换或保留原文（取决于名称是否已是 ASCII）
- 如 `v-in-cyberpunk-2077`、`johnny-in-ghost-in-the-shell`
- 输出目录由用户在导出流程中选择（Agent 通过 ask_user 询问）：
  - `.claude/skills/`（当前项目，可直接使用）
  - `~/.claude/skills/`（全局，所有项目可用）
  - `~/.soulkiller/exports/`（默认导出目录）
  - 自定义路径

### Decision 12: 用户可选导出目标路径

**选择**: Agent 在打包前通过 `ask_user` 询问用户目标路径，提供 4 个预设选项 + 自定义路径

**替代方案**: 固定输出到 `~/.soulkiller/exports/`，提示用户手动复制

**理由**: 导出的 Skill 最终目的是放到 `.claude/skills/` 中使用。固定输出再手动复制增加了不必要的摩擦。直接让用户选择目标路径，选 `.claude/skills/` 后即可立即使用，零额外操作。

## Risks / Trade-offs

- **[Skill prompt 长度]** Soul behaviors 文件较多时，SKILL.md 指示 Claude 按需读取文件可能消耗大量 context → 缓解：SKILL.md 作为调度器保持精简（< 200 行），Soul/World 内容通过 `${CLAUDE_SKILL_DIR}` 路径按需加载
- **[Cloud 模型差异]** 不同 Cloud 模型对视觉小说 prompt 的遵循程度不同 → 缓解：SKILL.md 规则写得足够具体和结构化，减少模型理解偏差
- **[AskUserQuestion 可用性]** AskUserQuestion 是 Claude Code 内置工具，Skill 只能通过 prompt 指示 Claude 使用它，无法强制 → 缓解：在 SKILL.md 中以强约束方式要求（"你必须使用 AskUserQuestion"）
- **[Agent 流程不确定性]** Agent 可能在某些情况下做出意外决策 → 缓解：system prompt 中明确约束 Agent 的行为边界和步骤顺序
- **[story-spec 质量]** story-spec.md 的规约质量影响 Cloud 端剧本生成效果 → 缓解：基调选项由 LLM 基于 Soul+World 推导，而非通用模板
