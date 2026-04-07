## ADDED Requirements

### Requirement: Soul system prompt 增加深度阅读工作流
SOUL_SYSTEM_PROMPT SHALL 指导 Agent 按维度执行 evaluate → read → extract → 下一维度 的完整循环。

#### Scenario: prompt 工作流指令
- **WHEN** 构建 system prompt
- **THEN** SHALL 指示 Agent 对每个维度依次：
  1. evaluateDimension 查看预览
  2. readFullResult 读取 top 3 条全文
  3. extractDimension 提交 3-5 条 extractions
  4. (可选) supplementSearch 补充
- **AND** SHALL 指示 Agent 最后调 reportFindings 汇总
