## 1. 重写 Round 1 搜索为程序驱动

- [x] 1.1 在 `soul-capture-agent.ts` 中新增 `runDeterministicSearch()` 函数：按固定策略执行 Tavily + Wikipedia 搜索，返回 WebSearchExtraction[]
- [x] 1.2 新增 `classifyWithLLM()` 函数：接收搜索结果上下文，单次调用 LLM（无 tools），返回 JSON 解析结果
- [x] 1.3 重写 `captureSoul()` 的 Round 1 部分：替换 LLM 工具调用循环为 `runDeterministicSearch()` + `classifyWithLLM()`
- [x] 1.4 移除 Round 1 中对 `schemas.search` / `schemas.wikipedia` 的 tools 参数使用

## 2. 进度事件兼容

- [x] 2.1 在 `runDeterministicSearch()` 中对每个搜索查询 emit `tool_call` / `tool_result` 进度事件，保持 Protocol Panel 兼容
- [x] 2.2 新增 `classifying` 阶段事件（LLM 分析中），在 `classifyWithLLM()` 调用前后 emit

## 3. 错误处理与重试

- [x] 3.1 单个搜索源失败时跳过不阻塞（try/catch 每个搜索调用）
- [x] 3.2 LLM 分析返回空文本或非 JSON 时重试一次
- [x] 3.3 移除旧的空文本 continue 重试逻辑和 6 次迭代循环

## 4. 清理

- [x] 4.1 移除 `search-factory.ts` 中不再需要的 `schemas` 导出（如果 Round 2 也不需要的话保留）
- [x] 4.2 移除 `captureSoul()` 中的 `messages` 累积逻辑和旧的 Round 1 fallback 搜索代码
- [x] 4.3 更新 `ROUND1_PROMPT` 为纯分析 prompt（不再包含工具使用指令）

## 5. 测试

- [x] 5.1 编写单元测试：`runDeterministicSearch()` 按预期执行固定数量的搜索调用
- [x] 5.2 编写单元测试：`classifyWithLLM()` 正确解析 JSON 响应，非 JSON 响应触发重试
- [x] 5.3 验证现有组件测试（create-command）仍通过
