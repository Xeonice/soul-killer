## MODIFIED Requirements

### Requirement: Distillation prompts include target name context
All distillation prompts (identity, style, behavior) SHALL include the target entity name and explicitly instruct the LLM to analyze the target entity, not the text itself.

#### Scenario: Identity prompt with name
- **WHEN** distilling identity for "强尼银手"
- **THEN** the prompt says "以下是关于【强尼银手】的描述...请从中提取【强尼银手】本人的核心身份特征"

#### Scenario: Style prompt distinguishes target from text
- **WHEN** distilling style for any entity
- **THEN** the prompt explicitly says "要分析的是目标人物的沟通风格，不是文章本身的写作风格"
