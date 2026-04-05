## 1. AgentLogger 核心类

- [x] 1.1 创建 `src/utils/agent-logger.ts`，实现 `AgentLogger` 类：constructor（生成文件名、创建目录、写 META 头）、`startStep`、`modelOutput`（buffer 累积）、`toolCall`、`toolInternal`、`toolResult`、`stepEnd`（flush text buffer + 写耗时）
- [x] 1.2 实现 `writeResult(result)` 方法，写 RESULT 区块（classification, origin, chunks, steps, duration）
- [x] 1.3 实现 `writeAnalysis(result, toolTimeline)` 方法，写 ANALYSIS 区块：维度覆盖直方图、搜索统计（unique queries/duplicates/total calls/unique URLs/page extraction success rate）、工具调用时间线
- [x] 1.4 实现 `close()` 方法和构造失败时的 graceful fallback（try-catch + 全局 logger warn）
- [x] 1.5 实现蒸馏阶段日志方法：`distillStart`、`distillPhase`、`distillBatch`、`distillMerge`、`distillGenerate`、`distillEnd`

## 2. Agent Loop 集成

- [x] 2.1 在 `soul-capture-agent.ts` 的 `captureSoul` 函数起始处创建 `AgentLogger` 实例
- [x] 2.2 在 `fullStream` 事件循环中集成：`start-step` → `startStep()`、`text-delta` → `modelOutput()`、`tool-call` → `toolCall()`、`tool-result` → `toolResult()`
- [x] 2.3 在函数返回前调用 `writeResult()` + `writeAnalysis()`，但不关闭 logger
- [x] 2.4 将 `AgentLogger` 实例通过 `createAgentTools` 的 options 传递给工具层
- [x] 2.5 `CaptureResult` 新增 `agentLog` 字段，返回 logger 实例给调用方

## 3. 工具层日志钩子

- [x] 3.1 修改 `search-factory.ts` 的 `createAgentTools`，接收 `agentLog?: AgentLogger` 参数
- [x] 3.2 在 search tool 的 execute 中注入日志：provider 名称、请求 URL（searxng）、原始结果数、短 snippet 识别数、页面提取逐条结果、总耗时
- [x] 3.3 在 extractPage tool 的 execute 中注入日志：URL、HTTP 状态推断（success/failed）、内容长度、耗时
- [x] 3.4 在 planSearch 和 checkCoverage tool 的 execute 中注入日志：输入摘要、输出摘要、耗时

## 4. 蒸馏流程日志集成

- [x] 4.1 `extractor.ts` 的 `extractFeatures` 新增可选 `agentLog?: AgentLogger` 参数
- [x] 4.2 identity/style/behavior 每个 batch LLM 调用记录耗时和输出长度（`distillBatch`）
- [x] 4.3 identity/style merge 调用记录输入 batch 数、耗时、输出长度（`distillMerge`）
- [x] 4.4 `create.tsx` 持有 `agentLogRef`，capture 结果存入 ref，distill 时传入 logger，完成后 `close()`
- [x] 4.5 `create.tsx` 在 distill 中记录 `distillStart`（model/totalChunks/sampledChunks）、`distillGenerate`（文件列表）、`distillEnd`（结果汇总）
- [x] 4.6 UNKNOWN_ENTITY 路径和 error 路径中及时 `close()` logger

## 5. 协议面板阶段分组

- [x] 5.1 `ToolCallDisplay` 新增 `phase` 字段，导出 `AgentPhase` 类型
- [x] 5.2 `create.tsx` 用 `useRef` 跟踪当前 phase，在 progress callback 中 tag 到每个 tool call
- [x] 5.3 面板用 `groupByPhase()` 按阶段分组渲染，每组显示阶段标签 + 完成/spinner 状态
- [x] 5.4 不同工具类型使用不同图标（🔍搜索 📄提取 📋规划 📊覆盖度）
- [x] 5.5 三语 i18n 新增阶段标签（`protocol.phase_recon` / `phase_planning` / `phase_collecting`）

## 6. /config 日志清理

- [x] 6.1 在 `config.tsx` 的菜单列表中新增 "Clean Agent Logs" 选项
- [x] 6.2 实现清理流程组件：读取日志目录 → 统计文件数和总大小 → 显示统计 → Y/N 确认 → 删除 → 显示结果
- [x] 6.3 处理边界情况：目录不存在或为空时显示 "No agent logs found" 并返回菜单
- [x] 6.4 三语 i18n 新增清理功能文案

## 7. 测试

- [x] 7.1 为 `AgentLogger` 编写单元测试：文件创建、META 头格式、step/tool/result/analysis 写入内容验证（11 tests）
- [x] 7.2 为 `/config` 清理流程编写组件测试：菜单项显示（zh/en）（2 tests）
- [x] 7.3 更新协议面板 snapshot 测试
