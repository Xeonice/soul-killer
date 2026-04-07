## MODIFIED Requirements

### Requirement: Capture Agent 工具集简化为质量筛选
Capture Agent SHALL 只拥有 evaluateDimension、supplementSearch、reportFindings 三个工具。

#### Scenario: 移除深度阅读工具
- **WHEN** 构建 capture agent 工具集
- **THEN** SHALL 不创建 readFullResult 和 extractDimension 工具

#### Scenario: reportFindings 简化
- **WHEN** Agent 调用 reportFindings
- **THEN** inputSchema SHALL 只包含 classification、origin、summary、dimensionStatus
- **AND** SHALL 不包含 extractions 字段
- **AND** dimensionStatus SHALL 报告每个维度的合格文章数和是否充分
