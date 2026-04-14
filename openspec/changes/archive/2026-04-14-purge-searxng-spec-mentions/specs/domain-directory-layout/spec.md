## MODIFIED Requirements

### Requirement: 基础设施目录
跨领域共用的基础设施 SHALL 收纳在 infra/ 目录下，不属于任何单一领域。

#### Scenario: 搜索后端
- **WHEN** soul 和 world 领域都需要使用搜索功能
- **THEN** infra/search/ SHALL 包含所有搜索后端实现（tavily、exa、page-extractor、title-filter）

#### Scenario: 通用 agent 框架
- **WHEN** soul 和 world 领域都需要使用通用捕获循环和 planning 框架
- **THEN** infra/agent/ SHALL 包含 capture-agent、planning-agent、dimension-framework、capture-strategy 和 tools/

#### Scenario: 数据适配器
- **WHEN** soul 和 world 领域都需要使用数据摄入适配器
- **THEN** infra/ingest/ SHALL 包含 types、pipeline 和所有适配器文件
