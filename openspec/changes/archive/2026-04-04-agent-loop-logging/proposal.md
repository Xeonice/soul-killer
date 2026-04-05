## Why

当前 Agent Loop（`captureSoul`）和蒸馏流程（`extractFeatures`）仅向单一的 `~/.soulkiller/debug.log` 追加少量关键节点日志，缺乏完整的调用链路、模型推理文本、工具内部细节（HTTP 请求/响应/耗时）、蒸馏 LLM batch 调用细节等信息，导致排查搜索质量、agent 行为和蒸馏质量问题时几乎无从下手。需要一个独立的、结构化的、per-session 日志系统来支撑全流程调试和优化。

## What Changes

- 新增 `AgentLogger` 类，每次 Agent Loop 调用生成独立日志文件（`~/.soulkiller/logs/agent/{timestamp}_{hash8}.log`），文件头写明原始 prompt
- 在 `fullStream` 事件循环中记录：模型文本输出（`text-delta`）、工具调用输入/输出、步骤耗时、阶段切换
- 在搜索工具内部（search-factory 包裹层）注入日志钩子，记录 provider 选择、HTTP 请求 URL/状态码、原始结果数、页面提取成败、每次调用耗时
- 日志末尾自动生成分析摘要：维度覆盖统计、搜索查询统计、工具调用时间线
- **AgentLogger 生命周期贯穿 capture → distill 全流程**：`captureSoul` 返回 logger 实例（不关闭），`create.tsx` 持有 ref 传给蒸馏流程，蒸馏完成后统一关闭
- 蒸馏阶段日志记录：每个维度（identity/style/behavior）的 batch LLM 调用耗时和输出长度、merge 调用、文件生成列表、蒸馏结果汇总
- 在 `/config` 命令中新增「Clean Agent Logs」选项，显示日志文件数和占用空间，二次确认后清理
- **协议面板按阶段分组展示**：工具调用按 Agent 三阶段（侦察/分析/采集）分组渲染，不同工具类型用不同图标

## Capabilities

### New Capabilities
- `agent-session-log`: 全流程独立日志文件系统 — AgentLogger 类、per-session 日志生成、混合格式输出（人类可读文本 + 关键节点完整 JSON）、搜索结果分析摘要、蒸馏阶段 batch/merge/generate 日志、蒸馏结果汇总
- `agent-log-cleanup`: Agent 日志清理功能 — `/config` 中的清理入口、日志空间统计、二次确认交互

### Modified Capabilities
- `soul-capture-agent`: Agent Loop 主流程集成 AgentLogger，在 stream 事件循环中调用日志方法；`CaptureResult` 新增 `agentLog` 字段，logger 不在 capture 内关闭
- `config-command`: `/config` 命令菜单新增 Clean Agent Logs 选项
- `soulkiller-protocol-panel`: 协议面板按 Agent 三阶段分组展示工具调用，`ToolCallDisplay` 新增 `phase` 字段，不同工具类型使用不同图标（🔍搜索 📄提取 📋规划 📊覆盖度）
- `soul-distill`: 蒸馏流程 `extractFeatures` 接收可选 `agentLog` 参数，记录每个 batch LLM 调用的耗时和输出长度

## Impact

- **新增文件**: `src/utils/agent-logger.ts`、`tests/unit/agent-logger.test.ts`
- **修改文件**:
  - `src/agent/soul-capture-agent.ts` — 集成 AgentLogger，`CaptureResult` 增加 `agentLog` 字段
  - `src/agent/tools/search-factory.ts` — 工具层日志钩子
  - `src/distill/extractor.ts` — 蒸馏 batch/merge 日志
  - `src/cli/commands/create.tsx` — logger 生命周期管理（capture → distill → close）、工具调用 phase 标记
  - `src/cli/animation/soulkiller-protocol-panel.tsx` — 按阶段分组渲染、工具图标
  - `src/cli/commands/config.tsx` — 日志清理入口
  - `src/i18n/locales/{zh,en,ja}.json` — 阶段标签、清理功能 i18n
  - `tests/component/config.test.tsx` — 清理功能组件测试
- **文件系统**: 运行时在 `~/.soulkiller/logs/agent/` 下产生日志文件
- **依赖**: 无新增外部依赖（使用 `node:fs`、`node:crypto`）
