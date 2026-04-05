## 1. Distill Agent 核心

- [x] 1.1 创建 `src/distill/distill-agent.ts`，定义 `distillSoul` 函数签名、`DistillResult` 接口、`DistillAgentProgress` 类型
- [x] 1.2 编写 DISTILL_SYSTEM_PROMPT（维度说明、推荐工作流、规则约束）
- [x] 1.3 实现 `sampleChunks` 工具
- [x] 1.4 实现 `writeIdentity` 工具
- [x] 1.5 实现 `writeStyle` 工具
- [x] 1.6 实现 `writeBehavior` 工具
- [x] 1.7 实现 `reviewSoul` 工具
- [x] 1.8 实现 `finalize` 工具
- [x] 1.9 组装 ToolLoopAgent

## 2. Stream 处理与 Progress

- [x] 2.1 实现 fullStream 事件循环
- [x] 2.2 集成 AgentLogger

## 3. 蒸馏面板改造

- [x] 3.1 `DistillProgressPanel` 改为动态工具调用列表
- [x] 3.2 工具图标映射

## 4. create.tsx 集成

- [x] 4.1 `startDistill` 改为调用 `distillSoul`
- [x] 4.2 处理 DistillAgentProgress 事件
- [x] 4.3 manifest 生成保留

## 5. Soul 完整性增强 — writeExample 工具

- [x] 5.1 在 `distill-agent.ts` 中实现 `writeExample` 工具：接收 scenario + messages[]，写入 `soulDir/examples/{scenario}.md`
- [x] 5.2 注册 writeExample 到 tools 对象，添加图标映射（💬）
- [x] 5.3 在 summarizeToolCallInput/summarizeToolResult 中处理 writeExample

## 6. System Prompt 增强

- [x] 6.1 style.md 引导：要求包含"典型表达/语录"区块，保留原话
- [x] 6.2 behaviors 引导：建议创建 relationships.md 描述关键关系
- [x] 6.3 examples 引导：推荐生成 3+ 组对话范例（打招呼、深度话题、冲突/敏感话题）
- [x] 6.4 maxSteps 调整为 25（增加 examples 步骤空间）

## 7. reviewSoul 扩展

- [x] 7.1 reviewSoul 工具同时读取 examples/ 目录，返回 examples 内容

## 8. 对话系统读取 examples

- [x] 8.1 `loadSoulFiles` 扩展返回值，加载 `examples/` 目录内容（`examples: Record<string, string>`）
- [x] 8.2 `SoulFiles` 接口新增 `examples` 字段
- [x] 8.3 `buildLegacyPrompt` 在 behaviors 后追加 `## Examples` 区块
- [x] 8.4 `assembleContext` 完整路径也注入 examples

## 9. 测试与验证

- [x] 9.1 类型检查通过
- [x] 9.2 现有测试全部通过
- [x] 9.3 验证 evolve 流程不受影响
