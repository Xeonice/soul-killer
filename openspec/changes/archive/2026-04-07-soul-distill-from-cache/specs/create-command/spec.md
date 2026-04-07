## MODIFIED Requirements

### Requirement: Capture result state management
After `captureSoul` returns, `create.tsx` SHALL persist capture result metadata to component state for downstream consumption.

#### Scenario: Web-search capture completes successfully
- **WHEN** `captureSoul` returns with `classification !== 'UNKNOWN_ENTITY'`
- **THEN** SHALL save `result.sessionDir` to `agentSessionDir` state
- **AND** SHALL save `result.dimensionPlan` to `capturedDimensions` state
- **AND** SHALL build `dimBreakdown` from `result.dimensionScores`（每维度 qualifiedCount）
- **AND** SHALL 从 sessionDir 重算 `chunkCount`（读取所有 .json 文件的 results.length 之和）

#### Scenario: Capture returns UNKNOWN_ENTITY
- **WHEN** `captureSoul` returns with `classification === 'UNKNOWN_ENTITY'`
- **THEN** SHALL 不保存 sessionDir 等数据
- **AND** SHALL 按现有逻辑进入 unknown 流程

### Requirement: Distill 调用路径分流
`create.tsx` SHALL 根据数据来源选择 distill 路径。

#### Scenario: Web-search 路径调用 distill
- **WHEN** 进入 distill 且 `agentSessionDir` 可用
- **THEN** SHALL 调用 `distillSoul(name, soulDir, config, { sessionDir: agentSessionDir, tags, onProgress, agentLog })`
- **AND** SHALL 不传 chunks 参数

#### Scenario: Local source 路径调用 distill
- **WHEN** 进入 distill 且无 `agentSessionDir`（仅有 local source）
- **THEN** SHALL 调用 `distillSoul(name, soulDir, config, { chunks: allChunks, tags, onProgress, agentLog })`
- **AND** allChunks 由 appendChunks + syntheticChunks + ingest chunks 组成

#### Scenario: 混合路径（web-search + local source）
- **WHEN** web-search 和 local source 都有数据
- **THEN** SHALL 将 local source chunks 转为补充维度写入 sessionDir
- **OR** SHALL 传入 sessionDir 同时附加 chunks（distillSoul 合并两路数据）
