## MODIFIED Requirements

### Requirement: search tool 跨搜索 URL 去重
search tool 在单次 capture agent 生命周期内 SHALL 维护已返回 URL 的集合，过滤重复结果。

#### Scenario: 过滤已见过的 URL
- **WHEN** search tool 返回结果集
- **AND** 其中某些 URL 在之前的搜索中已返回过
- **THEN** SHALL 从结果集中移除已见过的 URL
- **AND** 只返回新的、未见过的结果

#### Scenario: 全部结果重复时返回提示
- **WHEN** search tool 返回的所有结果 URL 都已见过
- **THEN** SHALL 返回空结果集
- **AND** SHALL 附加提示消息 `"All results were duplicates of previous searches. Try a different search angle."`

#### Scenario: 去重不影响 pre-search
- **WHEN** capture agent 执行 pre-search 阶段
- **THEN** pre-search 的结果 SHALL 被记录到已见 URL 集合
- **AND** 后续 agent loop 中的搜索 SHALL 基于此集合进行去重

#### Scenario: 去重状态不跨 capture 共享
- **WHEN** 启动新的 capture agent 实例
- **THEN** 已见 URL 集合 SHALL 为空
- **AND** 不继承之前 capture 的去重状态
