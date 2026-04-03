## Why

当前 Round 1 由 LLM 驱动搜索决策（自由选择是否调用工具、搜什么关键词），导致三个稳定复现的问题：(1) LLM 经 OpenRouter 中转后，工具调用循环结束时频繁返回空文本（responseMessageCount: 0），需要重试才能拿到分类结果；(2) LLM 可能不调搜索工具而直接用训练数据回答，导致信息不全或过时；(3) 搜索关键词由模型决定，不可复现、不可调试。应改为程序驱动搜索 + LLM 单次分析，消除工具调用循环的不稳定性。

## What Changes

- **BREAKING**: 移除 Round 1 的 LLM 工具调用循环，改为程序直接执行确定性搜索（Tavily + Wikipedia）
- 搜索完成后，将结果拼成上下文，单次调用 LLM 分析并输出结构化 JSON（classification、english_name、origin、summary）
- Round 2 定向搜索保持不变，继续使用 Round 1 解析出的 origin 做模板替换
- 移除 `captureSoul()` 中的 `tools` 参数和 `generateText` 工具调用相关逻辑
- 简化 CaptureProgress 事件：移除与 LLM 工具调用相关的状态，搜索进度改为程序驱动的事件

## Capabilities

### New Capabilities

_(无新增能力，为现有能力的实现重构)_

### Modified Capabilities
- `soul-capture-agent`: Round 1 从 LLM 驱动搜索改为程序驱动搜索 + LLM 单次分析

## Impact

- `src/agent/soul-capture-agent.ts` — 重写 Round 1 逻辑：移除工具调用循环，改为程序化搜索 + 单次 LLM 分析
- `src/agent/tools/search-factory.ts` — `schemas` 不再需要（LLM 不再调用工具），可简化
- `src/cli/animation/soulkiller-protocol-panel.tsx` — Protocol Panel 中 tool calls 的展示方式可能需要适配（搜索进度由程序事件驱动而非 LLM 工具调用）
