## MODIFIED Requirements

### Requirement: checkCoverage 使用动态 signals
checkCoverage tool SHALL 从 DimensionPlan 读取维度 signals 做 coverage 检测，而非使用硬编码正则。

#### Scenario: 基础维度使用 plan 中的 signals
- **WHEN** checkCoverage 分析 extractions
- **THEN** SHALL 从 DimensionPlan 读取每个维度的 signals
- **AND** SHALL 使用 signalsToRegex 将 signals 转为正则进行匹配

#### Scenario: 扩展维度同样参与 coverage 检测
- **WHEN** DimensionPlan 包含扩展维度
- **THEN** checkCoverage SHALL 对扩展维度同样执行 signals 匹配
- **AND** 扩展维度的覆盖状态 SHALL 影响 canReport 判断

#### Scenario: canReport 阈值保持不变
- **WHEN** 判断 canReport
- **THEN** soul 的阈值 SHALL 保持: 4+ 维度覆盖 + 2+ required 维度
- **AND** world 的阈值 SHALL 保持: 4+ 维度覆盖 + 2+ required 维度
