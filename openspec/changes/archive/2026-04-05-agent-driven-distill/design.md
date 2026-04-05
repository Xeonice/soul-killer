## Context

当前 `extractFeatures`（`extractor.ts`）是固定的 3 维度 × N batch 流水线。`evolve.tsx` 也调用它做增量蒸馏。`ExtractedFeatures` 接口被 `generator.ts` 和 `merger.ts` 依赖。

蒸馏面板 `DistillProgressPanel` 基于固定 5 阶段（identity/style/behavior/merge/generate）。

Soul 包结构有 `examples/` 和 `vectors/` 目录但从未被填充。对话时 `assembleContext` 只读取 identity/style/behaviors，不读 examples。

capture agent 已使用 Vercel AI SDK 的 `ToolLoopAgent`，有成熟的 stream/progress/logging 机制可复用。

## Goals / Non-Goals

**Goals:**
- 将 create 流程的蒸馏阶段改为 Agent 驱动
- Agent 通过工具约束产出结构
- Agent 可按需读取 chunks、跨维度引用、自检质量、迭代重写
- **Agent 生成对话范例（examples/）**，提供 few-shot 示例
- **Agent 在 style.md 中保留原话语录区块**
- **Agent 被引导创建 relationships 行为文件**
- **对话系统读取 examples/ 注入 system prompt**
- 蒸馏面板动态展示 Agent 工具调用
- 保留 AgentLogger 集成

**Non-Goals:**
- 不改 evolve 流程（继续用 `extractFeatures`）
- 不删除 `extractor.ts`
- 不改 merger.ts

## Decisions

### D1: 新文件 distill-agent.ts

`distillSoul` 函数，结构类似 `captureSoul`。

### D2: 工具设计（7 个）

```
sampleChunks({ dimension?, limit? })
  → 按 extraction_step 筛选 chunks
  → 默认 50 条，最多 100

writeIdentity({ content })
  → 写入 soulDir/soul/identity.md

writeStyle({ content })
  → 写入 soulDir/soul/style.md

writeBehavior({ name, content })
  → 写入 soulDir/soul/behaviors/{slug}.md

writeExample({ scenario, messages[] })
  → 写入 soulDir/examples/{scenario}.md
  → messages 是 [{role, content}] 对话对
  → 渲染为 markdown 格式的对话记录

reviewSoul()
  → 读回 soul/ + examples/ 下所有文件

finalize({ summary })
  → 无 execute，stopWhen 触发
```

### D3: System Prompt

引导 agent：
1. 推荐 identity → style → behaviors → examples 顺序
2. **style.md 要求**：必须包含"典型表达/语录"区块，保留原话而非分析描述
3. **behaviors 引导**：建议创建 relationships.md 描述关键关系和对不同人的态度
4. **examples 要求**：至少生成 3 组对话范例，覆盖打招呼、深度话题、冲突/敏感话题
5. 使用 reviewSoul 自检跨文件一致性

### D4: writeExample 工具详设

```typescript
writeExample({
  scenario: string,  // e.g., "greeting", "philosophy", "conflict"
  messages: [{ role: 'user' | 'character', content: string }]
})
```

写入格式：
```markdown
# greeting

> User: 你好
阿尔托莉雅: 吾乃骑士王阿尔托莉雅·潘德拉贡。你就是我的 Master 吗？

> User: 你最看重什么？
阿尔托莉雅: 身为王，我最看重的是对臣民的责任...
```

### D5: 对话系统读取 examples

在 `context-assembler.ts` 的 `buildLegacyPrompt` 和完整 `assembleContext` 中：
1. 读取 `soulDir/examples/*.md`
2. 注入 system prompt 的 `## Examples` 区块
3. 位于 behaviors 之后

`loadSoulFiles` 返回值扩展为 `{ identity, style, behaviors, examples }`。

### D6: ToolLoopAgent 配置

- model: `config.llm.distill_model ?? config.llm.default_model`
- temperature: 0.3
- maxSteps: 25（比之前的 20 增加，因为加了 examples 步骤）
- stopWhen: `[stepCountIs(25), hasToolCall('finalize')]`

### D7: Progress 事件 + 面板

动态工具调用列表，图标：📖 sampleChunks / ✏️ write* / 💬 writeExample / 🔍 reviewSoul / 📝 finalize

### D8: create.tsx 调用变化

`startDistill` 调用 `distillSoul`，agent 的 write* 工具直接写入文件，不再需要 `generateSoulFiles`。manifest 仍由 create.tsx 生成。

## Risks / Trade-offs

**[Agent 不写 examples]** → prompt 引导但不强制。如果 agent 跳过 examples，soul 仍然可用，只是对话质量略低。

**[examples 质量]** → Agent 基于已提取的 identity/style 生成范例，质量取决于 style.md 的准确性。reviewSoul 可以帮助自检。

**[loadSoulFiles 接口变化]** → 扩展返回值加 `examples`，旧调用方（evolve）需要适配。可以用可选字段 `examples?` 保持向后兼容。
