## ADDED Requirements

### Requirement: 批量标题快速过滤
系统 SHALL 在确定性搜索完成后、内容评分前，执行一次 LLM 调用批量审查所有文章标题。

#### Scenario: 过滤明显不相关的文章
- **WHEN** 搜索完成，缓存中有 N 篇文章
- **THEN** SHALL 将所有文章的 title + url + dimension 传给 LLM
- **AND** LLM SHALL 标记每篇 keep 或 drop
- **AND** drop 的文章 SHALL 从维度缓存中移除

#### Scenario: 宁可误留不可误杀
- **WHEN** 标题无法明确判断相关性
- **THEN** SHALL 标记为 keep（交给后续内容评分判断）

#### Scenario: prompt 包含目标信息
- **WHEN** 构造标题过滤 prompt
- **THEN** SHALL 包含目标名称和分类，帮助 LLM 判断相关性
