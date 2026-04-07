## ADDED Requirements

### Requirement: 段落级 extraction 规则
Capture agent 的 system prompt SHALL 要求每条 extraction 为完整段落（200-500 字符），而非单句事实。

#### Scenario: extraction 内容长度
- **WHEN** agent 调用 reportFindings 提交 extractions
- **THEN** system prompt SHALL 要求每条 extraction 包含完整段落
- **AND** SHALL 明确禁止将多段内容压缩为单句摘要

#### Scenario: extraction 数量限制
- **WHEN** agent 收集某一维度的 extractions
- **THEN** 每维度 SHALL 提交 3-5 条 extraction
- **AND** 总 extraction 数量 SHALL 在 15-35 条之间

#### Scenario: extraction 内容深度要求
- **WHEN** system prompt 定义 extraction 示例
- **THEN** SHALL 提供 BAD/GOOD 对比示例
- **AND** GOOD 示例 SHALL 包含因果关系、机制解释、影响分析

### Requirement: 强制 extractPage 获取全文
Capture agent 的 system prompt SHALL 要求对 REQUIRED 维度的重要搜索结果使用 extractPage 获取全文。

#### Scenario: REQUIRED 维度强制 extractPage
- **WHEN** agent 在 Collection 阶段处理 REQUIRED 维度
- **THEN** system prompt SHALL 要求对至少 2 个高质量搜索结果调用 extractPage
- **AND** SHALL 从 extractPage 全文中摘录完整段落而非从 snippet 摘录

#### Scenario: snippet 不足时升级
- **WHEN** 搜索结果 snippet 内容少于 300 字符
- **AND** 该结果的标题/URL 暗示有深度内容
- **THEN** system prompt SHALL 建议调用 extractPage 获取全文
