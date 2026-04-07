## Context

现有 skill 引擎采用 3-Phase 流程（Phase 0 长度选择 → Phase 1 LLM 创作剧本 → Phase 2 演出），剧本作为 LLM 内部上下文的一部分维持。这导致两个问题：

1. **重试不可复现**：用户在结局后选择"从头再来"，引擎重新跑 Phase 0 → Phase 1，LLM 会重新创作剧本，玩到的不是同一个故事
2. **剧本易丢失**：长对话场景下，Phase 1 的剧本可能因为上下文压缩而丢失关键细节，导致 Phase 2 演出与最初设定不一致

Skill 运行环境是 Claude（claude.ai 或 Claude Code），宿主提供 Read/Write 文件工具。skill 内部目录通过环境变量 `${CLAUDE_SKILL_DIR}` 引用。这给了我们持久化的物理基础——我们可以让 LLM 把剧本写到 skill 目录下的文件，下次启动再读回来。

相关代码：
- `src/export/skill-template.ts` — 生成 SKILL.md 的引擎规则文本
- `src/export/story-spec.ts` — 生成 story-spec.md 的剧本规约
- `src/export/packager.ts` — 打包 skill 归档

## Goals / Non-Goals

**Goals:**
- 剧本生成后持久化到文件，重试时复用同一份剧本
- 支持单 skill 多剧本并存（用户可以为同一 skill 生成多个不同命题的剧本）
- 支持存档系统：每个剧本独立的进度存档，存档关联到具体 script id
- 用户可重命名已生成的剧本以便管理
- "从头再来"语义明确化：重置 state，但保留 script

**Non-Goals:**
- 不引入剧本编辑能力（剧本生成后是只读的）
- 不引入跨 skill 的剧本迁移
- 不向后兼容旧 skill（旧 skill 继续按旧 Phase 流程运行）
- 不引入 chronicle 系统（那是另一个 change）
- 不修改剧本内部数据结构（schema 由 LLM 在 Phase 1 决定，本 change 只关心持久化容器）

## Decisions

### Decision 1: 剧本文件格式选 YAML

**选择**：YAML

**理由**：
- 用户已明确指定（讨论拍板）
- YAML 对剧本这种半结构化内容（场景列表、嵌套选项、长文本叙事）友好
- LLM 输出 YAML 的能力比 JSON 更稳定（YAML 容错性高，多行字符串自然）
- 人类可读，便于 debug

**文件命名**：`runtime/scripts/script-<8位短 hash>.yaml`

短 hash 通过 LLM 生成（基于时间戳 + user_direction 摘要），不需要严格唯一性保证——重复概率极低，万一冲突 LLM 会重新生成。

### Decision 2: 剧本内部 schema 不在本 change 中冻结

**选择**：让 Phase 1 的 LLM 自由决定 YAML 内部结构

**理由**：
- 现有 story-spec.md 已经定义了剧本的逻辑结构（scenes、choices、consequences、endings 等），LLM 已经知道怎么组织
- 本 change 的关注点是"容器"（持久化机制），不是"内容"（剧本格式）
- 强行定义 schema 会和 story-spec.md 重复，且可能限制未来扩展
- Phase 2 的 LLM 读自己（或同模型）写出的 YAML，能自然解析

**约束**：YAML 顶部 SHALL 包含 frontmatter 字段（id、generated_at、user_direction、acts）便于 Phase -1 列出剧本时显示元信息，但 scenes/endings 等正文部分由 LLM 自由组织。

**被 considered 后否决的替代方案**：
- 严格定义 scene/choice/ending 的字段——过度约束，而且 LLM 已经在按 story-spec 的格式输出
- 使用 markdown + frontmatter——markdown 对深嵌套结构支持差，scenes 列表会变得难以解析

### Decision 3: Phase -1 通过 List 工具检查目录决定流程

**选择**：在 SKILL.md 顶部插入 Phase -1，引擎启动时先用文件工具列出 `runtime/scripts/`

**流程**：
```
启动
  │
  ▼
List runtime/scripts/*.yaml
  │
  ├─ 为空 → 进入 Phase 0（长度选择）→ Phase 1（生成剧本，写文件）→ Phase 2
  │
  └─ 非空 → 列出剧本元信息（frontmatter 解析） → AskUserQuestion 让用户选：
            ├─ 继续某剧本的存档 → 读 script + 读 save → Phase 2
            ├─ 重试某剧本 → 读 script + 重置 state → Phase 2
            ├─ 重命名剧本 → 改 yaml 文件名 → 回菜单
            ├─ 删除剧本 → 删 yaml 文件 + 关联存档 → 回菜单
            └─ 生成新剧本 → Phase 0
```

**理由**：
- 不依赖 LLM "记住"是否已经生成过——文件系统是事实来源
- AskUserQuestion 已经是引擎和用户交互的标准方式，复用即可
- 列表显示用 frontmatter 元信息（剧本标题/命题/创建时间）足够用户辨识

### Decision 4: 存档结构——每个 slot 一个目录，含 script_ref

**目录结构**：
```
runtime/
├── scripts/
│   ├── script-abc12345.yaml
│   └── script-def67890.yaml
└── saves/
    ├── slot-1/
    │   ├── meta.yaml          ← script_ref: script-abc12345, 上次时间
    │   └── state.yaml         ← affinity / flags / current_scene
    └── slot-2/
        ├── meta.yaml
        └── state.yaml
```

**理由**：
- meta.yaml 单独存 script_ref 让"列出存档"操作不需要解析 state
- state.yaml 是热数据，每次场景流转都会更新
- slot-N 命名简单，第一版固定 3 个 slot 即可

**被否决的替代**：
- 一个文件存所有存档（saves.yaml）——并发风险、不易扩展
- 存档放在 script 文件旁边——耦合，删 script 会带走存档

### Decision 5: 剧本必须在 LLM 上下文里完整生成一次再写文件

**流程**：Phase 1 时 LLM 先在内部完整生成整个剧本，**然后**用 Write 工具一次性写入。不使用流式追加。

**理由**：
- 剧本是结构化整体，分段写容易破坏 YAML 结构
- LLM 一次性写入更可靠，错误恢复简单
- 写入完成后 LLM 上下文里仍保留剧本（继续 Phase 2 不需要重新读）

**风险**：剧本很大时单次 Write 可能触发上下文窗口压力，但典型剧本（5-10 个场景，每场景 200-500 字）在 5-10k token 范围内，可控。

### Decision 6: "从头再来" 语义改为重启当前 script

**旧语义**（skill-template.ts:199-206）：
> 重置 affinity + flags → 回到 Phase 0 → 重新生成剧本

**新语义**：
> 重置当前 script 关联存档的 state → 直接进入该 script 的 Phase 2 第一场景

**理由**：
- 用户在结局后选"从头再来"的直觉是"再玩这个故事"，不是"换个故事"
- 想换故事的用户可以在 Phase -1 菜单选"生成新剧本"
- 这让重玩真正快速且确定性

### Decision 7: 不向后兼容旧 skill

**理由**：
- 旧 skill 是已经分发出去的归档文件，无法升级
- 本 change 改的是 skill-template.ts 生成器，新生成的 skill 自带新规则
- 旧 skill 继续按旧规则运行（可能仍有重试不可复现的问题，但不会破坏）

## Risks / Trade-offs

**[Risk] LLM 可能忘记 Write 剧本到文件** → SKILL.md Phase 1 章节明确把 Write 工具调用作为 Phase 1 的退出条件，并要求 LLM 在写入后 echo 一句确认（"剧本已保存为 script-xxx.yaml"）。如果 LLM 跳过 Write，下一次启动会发现没有剧本，触发重新生成——容错失败模式不会卡死用户。

**[Risk] 用户在 claude.ai 环境下没有文件工具** → 这是硬约束。本 change 假设宿主环境提供 Read/Write/List 工具（Claude Code 满足，claude.ai 取决于 skill API 是否暴露文件能力）。如果不可用，需要在 SKILL.md 顶部声明依赖，引擎降级到旧行为（无持久化）。降级路径在第一版可不实现，文档说明即可。

**[Risk] YAML 解析错误导致整个 script 不可用** → Phase -1 解析失败时，把损坏的 script 标为 "corrupted"（重命名为 .yaml.broken），用户看到提示后可以选择删除或保留供 debug。不要让单个坏文件阻塞整个 Phase -1。

**[Risk] 多剧本场景下用户混淆** → frontmatter 元信息（user_direction、acts、created_at）在菜单里清晰展示。允许重命名是直接缓解。

**[Trade-off] LLM 生成剧本的成本仍然存在** → 第一次生成、生成新剧本仍然要付 LLM 创作成本。本 change 的价值是"已生成的剧本可以无成本复用"，而不是降低首次生成成本。

**[Trade-off] 剧本文件占用 skill 内部存储** → 单个剧本 5-10k token ≈ 30-60 KB，3-5 个剧本共 ~300 KB。可接受。

## Migration Plan

无运行时迁移（旧 skill 不升级）。生成器侧的迁移：

1. 改 `src/export/skill-template.ts`，单/多角色 engine 都加入 Phase -1 + 文件 IO 指令
2. 改 `src/export/story-spec.ts`，更新"重玩选项"章节描述
3. 改 `src/export/packager.ts`，确保打包时创建 `runtime/` 占位目录（含 `.gitkeep` 或 README.md）
4. E2E 测试：用一个测试 skill 验证 Phase -1 → Phase 0 → Phase 1（写文件）→ Phase 2 → 重试（读文件）流程

## Open Questions

- **文件工具的实际可用性**：需要在 Claude Code 环境验证 SKILL.md 内部能否调用 Read/Write/List。如果 skill 加载层有沙箱限制，方案可能要调整（比如把 runtime/ 放在 skill 外的用户目录）。第一版以 Claude Code 为目标平台。
- **slot 数量**：第一版固定 3 个 slot 还是动态？建议固定 3，简化 UX。
- **删除剧本时关联存档处理**：删 script 时是否级联删 saves/slot-*/ 中所有 script_ref 指向它的存档？建议是，防止 dangling 引用。
