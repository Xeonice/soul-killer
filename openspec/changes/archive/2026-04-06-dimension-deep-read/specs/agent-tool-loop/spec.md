## MODIFIED Requirements

### Requirement: Agent 工具集增加深度阅读工具
capture agent 的 ToolLoopAgent SHALL 拥有 evaluateDimension、readFullResult、extractDimension、supplementSearch、reportFindings 五个工具。

#### Scenario: 工具集完整
- **WHEN** 构建 capture agent 的工具集
- **THEN** SHALL 包含 evaluateDimension、readFullResult、extractDimension、supplementSearch、reportFindings

#### Scenario: maxSteps 适配深度阅读
- **WHEN** 配置 ToolLoopAgent
- **THEN** maxSteps SHALL 设为 dimCount * 5 + 5（每维度 ~5 步：evaluate + 3 reads + extract），上限 80
