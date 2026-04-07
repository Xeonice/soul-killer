# deterministic-search-executor Specification

## Purpose
TBD - created by archiving change deterministic-capture-pipeline. Update Purpose after archive.
## Requirements
### Requirement: 代码层按计划执行搜索
capture-agent SHALL 在 Agent loop 之前，用代码循环执行 DimensionPlan 中所有维度的 queries。

#### Scenario: 逐维度逐条执行
- **WHEN** DimensionPlan 包含 12 个维度，每维度 3 条 queries
- **THEN** SHALL 循环执行 36 条搜索，不由 LLM 决策
- **AND** 结果按维度分组存入文件缓存

#### Scenario: 搜索结果按维度缓存
- **WHEN** 一个维度的所有 queries 执行完毕
- **THEN** SHALL 将该维度的所有搜索结果写入 `~/.soulkiller/cache/search/{sessionId}/{dimensionName}.json`
- **AND** 每条结果保留完整 content（不截断）

#### Scenario: Exa 返回更多内容
- **WHEN** 使用 Exa 搜索引擎
- **THEN** maxCharacters SHALL 设为 10000（从 3000 提高）

#### Scenario: 移除 extractPage 依赖
- **WHEN** 构建 capture agent 工具集
- **THEN** SHALL 不创建 extractPage 工具
- **AND** 搜索引擎返回的全文内容 SHALL 作为唯一数据源

