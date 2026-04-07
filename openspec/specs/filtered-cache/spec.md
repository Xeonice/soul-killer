# filtered-cache Specification

## Purpose
TBD - created by archiving change quality-filter-pipeline. Update Purpose after archive.
## Requirements
### Requirement: 评分后过滤缓存
内容评分完成后，SHALL 只保留 score >= 3 的文章，按评分从高到低排序写入维度缓存。

#### Scenario: 剔除低分文章
- **WHEN** 内容评分完成
- **THEN** SHALL 从维度缓存中移除 score < 3 的文章
- **AND** 剩余文章 SHALL 按评分从高到低排序

#### Scenario: 评分信息持久化
- **WHEN** 过滤写入缓存
- **THEN** 每篇文章 SHALL 附带 score 和 reason 信息

