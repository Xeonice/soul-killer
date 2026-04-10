## ADDED Requirements

### Requirement: 领域目录组织
src/ SHALL 按业务领域组织业务代码。三个业务领域（soul, world, export）各自拥有独立的顶层目录，每个领域目录 SHALL 包含该领域完整的 capture → distill → manage 流程代码。

#### Scenario: soul 领域内聚
- **WHEN** 开发者需要理解 soul 的完整流程
- **THEN** soul/ 目录下 SHALL 包含 capture/（捕获 agent + 策略 + 维度）、distill/（蒸馏 agent + sampler + extractor + generator + merger）、batch-pipeline、manifest、package、snapshot

#### Scenario: world 领域内聚
- **WHEN** 开发者需要理解 world 的完整流程
- **THEN** world/ 目录下 SHALL 包含 capture/（捕获 agent + 策略 + 维度）以及已有的 distill、entry、chronicle、context-assembler、manifest、binding、resolver、template

#### Scenario: export 领域内聚
- **WHEN** 开发者需要理解 export 的完整流程
- **THEN** export/ 目录下 SHALL 包含 agent/（拆分后的导出 agent 模块）以及已有的 skill-template、story-spec、packager、lint、state、prose-style、format

### Requirement: 基础设施目录
跨领域共用的基础设施 SHALL 收纳在 infra/ 目录下，不属于任何单一领域。

#### Scenario: 搜索后端
- **WHEN** soul 和 world 领域都需要使用搜索功能
- **THEN** infra/search/ SHALL 包含所有搜索后端实现（tavily、searxng、exa、page-extractor、title-filter）

#### Scenario: 通用 agent 框架
- **WHEN** soul 和 world 领域都需要使用通用捕获循环和 planning 框架
- **THEN** infra/agent/ SHALL 包含 capture-agent、planning-agent、dimension-framework、capture-strategy 和 tools/

#### Scenario: 数据适配器
- **WHEN** soul 和 world 领域都需要使用数据摄入适配器
- **THEN** infra/ingest/ SHALL 包含 types、pipeline 和所有适配器文件

### Requirement: CLI 命令按领域分组
cli/commands/ SHALL 按领域建子目录，消除平铺的文件列表。

#### Scenario: 命令子目录
- **WHEN** 开发者需要找到某个命令的实现
- **THEN** cli/commands/ SHALL 包含 soul/（create、use、list、evolve、evolve-status、evolve-rollback、feedback）、world/（world、world-bind、world-create-wizard、world-distill、world-distill-review、world-entry、world-list）、export/（export、pack、unpack）、system/（help、config、model、status、recall、source）四个子目录

### Requirement: export-agent 模块化
原 agent/export-agent.ts（2,453 行）SHALL 拆分为 export/agent/ 下的多个模块，每个模块不超过 600 行。

#### Scenario: 拆分后模块结构
- **WHEN** 开发者查看 export/agent/ 目录
- **THEN** SHALL 包含 types.ts、prompts.ts、agent-loop.ts、planning.ts、story-setup.ts、character.ts、finalize.ts、index.ts 共 8 个文件

#### Scenario: 入口保持兼容
- **WHEN** 其他模块需要使用导出 agent
- **THEN** export/agent/index.ts SHALL 导出 runExportAgent 和 computeExportStepCap 函数，调用方只需改 import 路径

### Requirement: 旧顶层目录清除
重组完成后，agent/、distill/、ingest/ 三个顶层目录 SHALL 被完全删除，不留任何文件。

#### Scenario: 无残留文件
- **WHEN** 重组完成后检查 src/ 顶层目录
- **THEN** agent/、distill/、ingest/ 不存在
