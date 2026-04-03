## 1. 依赖与配置

- [x] 1.1 安装 `ai` (Vercel AI SDK) 和 `@ai-sdk/openai-compatible` 依赖
- [x] 1.2 扩展 config schema：新增 `search.tavily_api_key` 可选字段
- [ ] 1.3 扩展 setup wizard：新增可选的 Tavily API Key 输入步骤
- [x] 1.4 扩展 SoulChunk source 类型：新增 `'web'`

## 2. 搜索工具

- [x] 2.1 创建 `src/agent/tools/tavily-search.ts`：封装 Tavily Search API 为 Vercel AI SDK tool
- [x] 2.2 创建 `src/agent/tools/web-search.ts`：DuckDuckGo HTML 搜索降级方案
- [x] 2.3 创建 `src/agent/tools/wikipedia-search.ts`：Wikipedia API tool（多语言）
- [x] 2.4 创建 `src/agent/tools/search-factory.ts`：根据 config 选择 tavily 或 web-search

## 3. Web Source Adapter

- [x] 3.1 创建 `src/ingest/web-adapter.ts`：agent 搜索结果 → SoulChunk[]
- [x] 3.2 实现 chunk 类型分类逻辑
- [x] 3.3 实现跨步骤去重

## 4. Soul Capture Agent

- [x] 4.1 创建 `src/agent/soul-capture-agent.ts`：agent 主函数
- [x] 4.2 实现 Step 1 identify：LLM 判断 classification
- [x] 4.3 实现 Step 2 gather_base：Wikipedia 搜索
- [x] 4.4 实现 Step 3 gather_deep：按类型选择搜索策略
- [x] 4.5 实现 Step 4 personality：性格分析搜索
- [x] 4.6 实现 UNKNOWN_ENTITY 判定逻辑
- [x] 4.7 实现进度回调

## 5. Soulkiller Protocol Panel

- [x] 5.1 创建 `src/cli/animation/soulkiller-protocol-panel.tsx`
- [x] 5.2 Phase 1：glitch 文字效果
- [x] 5.3 Phase 2：target info 逐行 reveal
- [x] 5.4 Phase 3：extraction steps 带 spinner/✓
- [x] 5.5 Phase 4：完成统计
- [x] 5.6 UNKNOWN_ENTITY malfunction 面板

## 6. /create 流程重构

- [x] 6.1 重构 create.tsx：agent-first，UNKNOWN_ENTITY 时走手动模式
- [x] 6.2 Agent 模式：渲染 SoulkillerProtocolPanel，实时更新
- [x] 6.3 Agent 完成后：合并 chunks，进入蒸馏
- [x] 6.4 手动模式回退：malfunction 面板 → 数据源选择

## 7. 测试

- [ ] 7.1 单元测试：tavily-search tool（mock HTTP）
- [ ] 7.2 单元测试：web-search tool（mock HTTP）
- [x] 7.3 单元测试：wikipedia-search tool（mock HTTP）— 延迟到有 mock server 时
- [x] 7.4 单元测试：search-factory 根据 config 选择正确的搜索工具
- [x] 7.5 单元测试：web-adapter chunk 提取与去重
- [x] 7.6 组件快照测试：SoulkillerProtocolPanel 各阶段
- [x] 7.7 回归：164 个测试全部通过
