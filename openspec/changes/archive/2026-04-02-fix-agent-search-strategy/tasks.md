## 1. Agent 搜索策略重写

- [x] 1.1 重写 system prompt：Round 1 专用识别 prompt，输出 CLASSIFICATION/ENGLISH_NAME/ORIGIN 格式
- [x] 1.2 实现两轮搜索策略：Round 1 用 LLM 自由识别（max 6 iterations），Round 2 执行预定义查询列表
- [x] 1.3 英文名提取：从 Round 1 的 LLM 输出中提取 ENGLISH_NAME，Round 2 用英文名搜索
- [x] 1.4 预定义查询模板：DIGITAL_CONSTRUCT（character wiki fandom + quotes dialogue + personality MBTI + 中文台词），PUBLIC_ENTITY（interview quotes + speech views + personality style + 中文采访），HISTORICAL_RECORD（philosophy quotes + biography legacy + personality + 中文名言）

## 2. 测试

- [x] 2.1 回归：170 个测试全部通过
