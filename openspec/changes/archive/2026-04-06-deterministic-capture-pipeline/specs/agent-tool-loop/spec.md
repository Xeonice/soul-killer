## MODIFIED Requirements

### Requirement: Agent 工具集简化
capture agent 的 ToolLoopAgent SHALL 只拥有 evaluateDimension、supplementSearch、reportFindings 三个工具。

#### Scenario: 移除搜索类工具
- **WHEN** 构建 capture agent 的工具集
- **THEN** SHALL 不创建 search、extractPage、planSearch、checkCoverage 工具
- **AND** SHALL 创建 evaluateDimension、supplementSearch、reportFindings 工具

#### Scenario: Agent 工作流程
- **WHEN** Agent 开始运行
- **THEN** system prompt SHALL 指示 Agent 按维度顺序工作
- **AND** 每个维度: 先 evaluateDimension → 判断 → 可选 supplementSearch → 下一个维度
- **AND** 所有维度审查完后调用 reportFindings

#### Scenario: supplementSearch 上限
- **WHEN** Agent 调用 supplementSearch
- **THEN** 工具 SHALL 跟踪每维度的补充次数
- **AND** 超过 2 次/维度时返回错误，阻止继续补充
