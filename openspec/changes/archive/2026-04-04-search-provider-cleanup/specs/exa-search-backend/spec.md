## ADDED Requirements

### Requirement: Exa 搜索执行器
系统 SHALL 提供 Exa 搜索函数，通过 `exa-js` SDK 调用 Exa API 的 `searchAndContents` 端点，直接返回包含全文的搜索结果。

#### Scenario: 正常搜索
- **WHEN** 调用 executeExaSearch(apiKey, "Artoria Pendragon")
- **THEN** 向 Exa API 发送 searchAndContents 请求（type: auto, numResults: 10, text.maxCharacters: 3000）
- **AND** 返回 SearchResult 数组（title, url, content），content 为页面全文

#### Scenario: API key 无效
- **WHEN** Exa API 返回认证错误
- **THEN** 抛出错误，由上层处理
