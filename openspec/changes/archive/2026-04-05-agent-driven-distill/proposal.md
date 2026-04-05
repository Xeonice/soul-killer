## Why

当前蒸馏流程是硬编码的三维度流水线（identity → style → behaviors），用固定 batch 大小（30）逐批 LLM 调用再 merge。存在以下问题：

- **无法跨维度引用**：写 style 时不参考 identity，导致人物描述和语言风格可能矛盾
- **merge 质量差**：多 batch 结果机械拼接，常有重复和不一致
- **行为文件数不可控**：靠 `---` 分隔符 parse，经常产出不合理的行为切分
- **无质量自检**：写完就算完，没有回头审查一致性的机会
- **不利用维度标签**：chunks 已有 `extraction_step` 维度信息，但 sampler 按 `source:type` 分组，完全忽略维度
- **缺少对话范例**：`examples/` 目录已创建但始终为空，对话时无 few-shot 示例，LLM 只能靠描述性文字推测语气
- **style.md 缺少原话语录**：搜索采集了 quotes 维度的直接引用，但蒸馏时被浓缩成分析文字，丢失了最能锁定语气的原始表达
- **对话系统不读取 examples/**：`assembleContext` 和 `buildLegacyPrompt` 都没有读取 examples/ 目录

## What Changes

- 用 Vercel AI SDK 的 `ToolLoopAgent` 替代固定流水线，将蒸馏过程改为 Agent 驱动
- 提供约束性工具：`sampleChunks`（按维度读取数据）、`writeIdentity`、`writeStyle`、`writeBehavior`（写入灵魂文件）、`writeExample`（写入对话范例）、`reviewSoul`（回读已写文件自检）、`finalize`（结束蒸馏）
- System prompt 建议 identity → style → behaviors → examples 顺序，引导 style.md 保留原话语录区块，引导创建 relationships 行为文件
- maxSteps 兜底 + doom loop 检测
- 蒸馏面板从固定 5 阶段改为动态工具调用展示
- AgentLogger 蒸馏部分适配新的 Agent 事件流
- 对话系统 `assembleContext` / `buildLegacyPrompt` 加载 examples/ 作为 few-shot 示例注入 system prompt

## Capabilities

### New Capabilities
- `distill-agent`: Agent 驱动的蒸馏流程 — ToolLoopAgent + 7 个工具 + system prompt + 进度事件

### Modified Capabilities
- `soul-distill`: 删除旧的 `extractFeatures` 固定流水线，替换为 `distillSoul` Agent 入口
- `create-command`: `startDistill` 调用新的 `distillSoul` 替代 `extractFeatures`，蒸馏面板改为动态展示
- `soul-conversation`: `assembleContext` 和 `buildLegacyPrompt` 读取 examples/ 目录，注入对话范例

## Impact

- **新增文件**: `src/distill/distill-agent.ts`（Agent 入口 + system prompt + 工具定义）
- **修改文件**: `src/cli/commands/create.tsx`（调用新 agent）、`src/cli/components/distill-progress.tsx`（动态面板）、`src/world/context-assembler.ts`（加载 examples）、`src/distill/generator.ts`（loadSoulFiles 加载 examples）
- **保留文件**: `src/distill/sampler.ts`、`src/distill/merger.ts`（evolve 流程仍用）
- **废弃**: `src/distill/extractor.ts` 不再被 create 流程调用（evolve 流程保留）
- **依赖**: 无新增
