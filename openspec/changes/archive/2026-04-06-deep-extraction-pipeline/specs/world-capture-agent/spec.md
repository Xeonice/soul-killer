## MODIFIED Requirements

### Requirement: World Extraction Guidelines
World capture agent 的 system prompt SHALL 在 Extraction Guidelines 中要求段落级深度提取。

#### Scenario: extraction 深度规则
- **WHEN** WORLD_SYSTEM_PROMPT 定义 Extraction Guidelines
- **THEN** SHALL 要求每条 extraction 为完整段落（200-500 字符）
- **AND** SHALL 要求每维度 3-5 条 extraction，总计 20-35 条
- **AND** SHALL 提供 BAD/GOOD 对比示例，GOOD 示例包含因果分析

#### Scenario: extractPage 使用规则
- **WHEN** WORLD_SYSTEM_PROMPT 定义 Collection 阶段规则
- **THEN** SHALL 要求对 REQUIRED 维度（geography/history/factions）的重要搜索结果使用 extractPage
- **AND** SHALL 要求从 extractPage 全文中摘录完整段落
