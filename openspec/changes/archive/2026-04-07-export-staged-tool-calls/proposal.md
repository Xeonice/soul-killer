## Why

上一轮 `export-user-driven-selection` 把 export-agent 收紧为创意工作，但保留了**单次大输入**的 `package_skill` 工具：一个调用塞了 souls + world_name + 完整 story_spec（含 4 个角色 × 2-3 个好感轴 + constraints + dynamics_note 等）。实测发现这是工具设计上的根本缺陷：

1. **单步生成 ~1000 tokens 的嵌套 JSON** — 慢、易错、流式不友好
2. **glm-5 等模型把超大 input 当字符串字面量发送** — 即使有 `z.preprocess` 兼容补丁，本质上是 LLM 不擅长生成复杂结构化 tool input
3. **决策耦合** — 4 个角色的所有决策必须一次性想完，无法增量推理
4. **无进度可见性** — 用户从 "tool-call" 到 "tool-result" 之间看不到任何活动
5. **错误粒度粗** — 一个角色的轴配错，整个调用废掉重来

LLM 真正擅长的是 **agentic 多步对话**，而不是"一次性翻译成大 JSON"。工具设计应该顺应这一点。

此外，原设计将 **acts (幕数)** 作为 export agent 的硬决策（"≤2 → 3 幕，3-4 → 4 幕"），但这本应是 **skill runtime 用户的选择**——同一个角色组合，用户可能想要短篇或长篇体验。本 change 一并修正这点：agent 只提供"幕数选项"，由 SKILL.md 引擎在 Phase 0 让用户选择。

## What Changes

### 拆分 package_skill 为多阶段工具

```
旧:
  package_skill({ souls, world_name, story_spec: {...一个大对象} })

新:
  set_story_metadata({
    genre, tone, constraints[],
    acts_options: [{ acts, label_zh, rounds_total, endings_count }, ...],  ← runtime 可选
    default_acts                                                              ← 推荐默认
  })
  add_character({ name, role, display_name?, appears_from?, dynamics_note? })  ← 每个角色一次
  set_character_axes({ character_name, axes: [{name, english, initial} × 2-3] })  ← 每个角色一次
  finalize_export({ output_dir? })  ← 触发实际打包
```

每个工具调用 input 控制在 200 tokens 以内，LLM 不会再生成失败。

### 幕数从硬决策变为 runtime 选项

- export agent 在 `set_story_metadata` 中提供 2-3 个幕数预设（如 短篇/中篇/长篇）
- story-spec.md frontmatter 改为存储 `acts_options` 数组和 `default_acts`
- SKILL.md 引擎在 Phase 0 增加幕数选择步骤：根据 acts_options 让用户选
- `appears_from` 仍然以 `act_N` 形式描述，但渲染时根据所选 acts 总数验证（出场幕大于总幕数 → 报错）

### 累积器模式

`runExportAgent` 内部维护一个 `ExportBuilder` 对象，工具调用累积状态：
- `set_story_metadata` 写入 metadata
- `add_character` 追加 character（顺序保持调用顺序）
- `set_character_axes` 给指定 character 补充 axes（按 name 匹配）
- `finalize_export` 读取累积状态构造完整 story_spec 并调 `packageSkill`

### 错误反馈与重试

每个工具的 execute 函数返回结构化结果：
- 成功：`{ ok: true, summary: "..." }` 让 agent 看到推进
- 失败：`{ error: "..." }` 让 agent 在下一步修正

### System prompt 更新

引导 agent 按阶段操作：
1. 先 `set_story_metadata`
2. 对每个角色 `add_character` + `set_character_axes`
3. 最后 `finalize_export`

### 错误兜底加强

`finalize_export` 之前如果 builder 状态不完整（缺 metadata、缺角色、某角色缺 axes），返回明确错误让 agent 补全。

## Capabilities

### Modified Capabilities
- `export-agent`: tool 体系从单一 `package_skill` 重构为多阶段 builder 工具集；幕数从硬决策变为运行时选项
- `multi-soul-export`: SKILL.md 引擎 Phase 0 新增幕数选择步骤；story-spec frontmatter 字段更新

## Impact

- `src/agent/export-agent.ts` — 移除 `package_skill` tool，新增 4 个分阶段 tools 和 ExportBuilder 状态；set_story_metadata 接受 acts_options 而非单一 acts
- `src/export/story-spec.ts` — `StorySpecConfig` 类型从 `acts: number` 改为 `acts_options: ActOption[]` + `default_acts: number`
- `src/export/packager.ts` — story-spec.md 生成逻辑适配新字段
- `src/export/skill-template.ts` — SKILL.md 模板新增 Phase 0 幕数选择阶段，根据所选 acts 计算 rounds budget
- `src/cli/animation/export-protocol-panel.tsx` — 可能需要适配多 tool 的 trail 展示（小改动）
- 测试 / E2E — 适配新工具流和 story-spec 新字段
