## 1. Agent 重构为 Manual Loop

- [x] 1.1 重构 `soul-capture-agent.ts`：while loop + generateText 无 stopWhen + 手动 tool 执行
- [x] 1.2 扩展进度回调类型：tool_call、tool_result、classification、chunks_extracted、phase
- [x] 1.3 tool 拆分为 schema（给 LLM）+ execute 函数（手动调用）：tavily、web-search、wikipedia 全部重构
- [x] 1.4 分类逻辑从 LLM 文本输出中正则提取 + 模糊匹配
- [x] 1.5 搜索结果直接用 web-adapter 转 chunks
- [x] 1.6 max iterations 安全阀（15 轮）

## 2. Protocol Panel 实时展示

- [x] 2.1 Panel props 改为 toolCalls 数组：{ tool, query, status, resultCount }
- [x] 2.2 extraction 区域实时显示每个 tool call：🔍/📖 + 查询 + spinner/✓ + 结果数
- [x] 2.3 classification 获取后实时更新 Panel

## 3. Create 流程对接

- [x] 3.1 create.tsx 对接新 CaptureProgress 类型，更新 toolCalls/classification/phase 状态

## 4. 测试

- [x] 4.1 回归：170 个测试全部通过（含更新的 search-factory、tavily、web-search、panel 测试）
