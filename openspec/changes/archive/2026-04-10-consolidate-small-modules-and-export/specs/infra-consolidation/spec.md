## ADDED Requirements

### Requirement: src/ 顶层目录精简
src/ 顶层 SHALL 只包含 6 个目录：cli, soul, world, export, infra, config。不得存在 tags, llm, engine, utils, i18n, pack 等独立顶层目录。

#### Scenario: 顶层目录检查
- **WHEN** 列出 src/ 的直接子目录
- **THEN** 结果 SHALL 为 cli, config, export, infra, soul, world（加上 index.tsx 入口文件）

### Requirement: tags 按领域归属
soul 标签体系（taxonomy.ts, parser.ts）SHALL 位于 soul/tags/，world 标签体系（world-taxonomy.ts）SHALL 位于 world/tags/。

#### Scenario: soul tags 位置
- **WHEN** 查找 TagSet 类型定义
- **THEN** 位于 soul/tags/taxonomy.ts

#### Scenario: world tags 位置
- **WHEN** 查找 WorldTagSet 类型定义
- **THEN** 位于 world/tags/world-taxonomy.ts

### Requirement: export 三层分离
export/ SHALL 按三层组织：agent/（流程编排）、spec/（产物定义）、support/（辅助工具），加上 state/（独立运行时）和 pack/（打包分发）。

#### Scenario: 产物定义层
- **WHEN** 查找 skill 模板或 story-spec 配置
- **THEN** 位于 export/spec/ 下

#### Scenario: 辅助工具层
- **WHEN** 查找 lint、prose-style 或 format 工具
- **THEN** 位于 export/support/ 下

### Requirement: pack 归入 export 领域
pack/（packer, unpacker, meta, checksum）SHALL 位于 export/pack/ 下。

#### Scenario: pack 位置
- **WHEN** 查找打包/解包功能
- **THEN** 位于 export/pack/ 下

### Requirement: infra 统一基础设施
infra/ SHALL 包含所有跨领域共用的基础设施：agent, search, ingest, llm, engine, utils, i18n。

#### Scenario: LLM 客户端位置
- **WHEN** 查找 LLM 客户端配置
- **THEN** 位于 infra/llm/ 下

#### Scenario: 引擎适配器位置
- **WHEN** 查找搜索引擎适配器
- **THEN** 位于 infra/engine/ 下
