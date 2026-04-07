## MODIFIED Requirements

### Requirement: Soul Extraction Guidelines
Soul capture agent 的 system prompt SHALL 在 Extraction Guidelines 中要求段落级深度提取，与 World agent 保持一致。

#### Scenario: extraction 深度规则
- **WHEN** SOUL_SYSTEM_PROMPT 定义 Extraction Guidelines
- **THEN** SHALL 要求每条 extraction 为完整段落（200-500 字符���
- **AND** SHALL 要求每维度 3-5 条 extraction，总计 15-30 条
- **AND** SHALL 提供 BAD/GOOD 对比示例

#### Scenario: extractPage 使用规则
- **WHEN** SOUL_SYSTEM_PROMPT 定义 Collection 阶��规则
- **THEN** SHALL 要求对 REQUIRED 维��（identity/quotes/expression）的重要搜索结果使用 extractPage
- **AND** SHALL 要求���全文中摘录完整段落而非从 snippet 单句摘要
