## MODIFIED Requirements

### Requirement: readFullResult 工具
Agent SHALL 拥有 readFullResult 工具，按 index 读取某个维度缓存中一条结果的全文。

#### Scenario: 读取单条全文
- **WHEN** Agent 调用 readFullResult(dimensionName, index)
- **THEN** SHALL 从维度缓存文件读取第 index 条结果
- **AND** 返回 title、url、content（content 截断到 3000 chars）

#### Scenario: 无效 index
- **WHEN** index 超出范围
- **THEN** SHALL 返回错误提示

### Requirement: extractDimension 工具
Agent SHALL 拥有 extractDimension 工具，按维度提交 extractions，在 reportFindings 之前分段积累。

#### Scenario: 提交维度 extractions
- **WHEN** Agent 调用 extractDimension(dimensionName, extractions[])
- **THEN** SHALL 将 extractions 存入内存缓冲区，按维度分组
- **AND** 返回已提交的数量和累计总数

#### Scenario: extraction 格式
- **WHEN** extractions 被提交
- **THEN** 每条 SHALL 包含 content(200-500 chars)、url、searchQuery、dimension

### Requirement: reportFindings 汇总已提取的 extractions
reportFindings SHALL 在调用时合并所有通过 extractDimension 累积的 extractions。

#### Scenario: 自动合并
- **WHEN** Agent 调用 reportFindings
- **THEN** SHALL 将 reportFindings 自带的 extractions 与 extractDimension 累积的 extractions 合并
- **AND** 合并后的总 extractions 作为最终结果
