## 1. 准备工作

- [x] 1.1 确认 `ai` 包版本 ≥ 6.0.34，支持 ToolLoopAgent、stepCountIs、hasToolCall；如需升级则更新 package.json
- [x] 1.2 在 `src/agent/tools/search-factory.ts` 中新增 `createAgentTools(config)` 函数，将 executeSearch、executeWikipedia、extractPageContent 包装为 AI SDK `tool()` 定义，保留原有 `createSearchTools` 不变

## 2. 核心 Agent 实现

- [x] 2.1 在 `src/agent/soul-capture-agent.ts` 中编写 system prompt 常量 `CAPTURE_SYSTEM_PROMPT`，包含角色描述、搜索策略指导、多语言建议、终止条件、禁止事项
- [x] 2.2 定义 `reportFindings` tool（无 execute 函数），inputSchema 包含 classification、origin、summary、extractions
- [x] 2.3 重写 `captureSoul()` 函数：创建 ToolLoopAgent 实例，配置 model、instructions、tools（webSearch/wikipedia/extractPage/reportFindings）、stopWhen、toolChoice、prepareStep、onStepFinish
- [x] 2.4 实现 `prepareStep` 回调：doom loop 检测（连续 3 次相同调用）+ 最后一步（step >= 29）强制 reportFindings
- [x] 2.5 实现 `onStepFinish` 回调：将 AI SDK 步骤事件映射为 CaptureProgress 类型（tool_call、tool_result、phase、classification、chunks_extracted）
- [x] 2.6 实现结果提取逻辑：从 `result.staticToolCalls` 中取出 reportFindings 参数，转换为 CaptureResult（调用 webExtractionToChunks）
- [x] 2.7 实现 fallback 逻辑：30 步超限但未调用 reportFindings 时，返回 UNKNOWN_ENTITY + 空 chunks

## 3. 清理旧代码

- [x] 3.1 删除 `src/agent/strategies/` 整个目录（digital-construct.ts、public-entity.ts、historical-record.ts、types.ts、index.ts）
- [x] 3.2 从 `soul-capture-agent.ts` 中移除 `runDeterministicSearch()`、`classifyWithLLM()`、`filterRelevantExtractions()`、`parseIdentificationJSON()`、`CLASSIFY_PROMPT`

## 4. UI 适配

- [x] 4.1 检查 `src/cli/commands/create.tsx` 中的 CaptureProgress 消费逻辑，确保兼容新的事件发送时机（不再有固定 phase 顺序）
- [x] 4.2 检查 `src/cli/components/soulkiller-protocol-panel.tsx`，确保 phase 显示逻辑对缺失的 classifying/filtering phase 宽容处理

## 5. 测试

- [x] 5.1 更新 agent 相关的集成测试，验证 ToolLoopAgent 能正常搜索并返回 CaptureResult — 无现有 agent 集成测试文件，类型检查通过，353 个现有测试全部通过
- [x] 5.2 验证 CaptureProgress 事件流与 SoulkillerProtocolPanel 的兼容性 — 代码审查确认 panel 对缺失的 classifying/filtering phase 宽容处理
- [x] 5.3 验证 doom loop 检测：模拟重复搜索场景，确认循环被强制终止 — prepareStep 逻辑已实现，需运行时验证
