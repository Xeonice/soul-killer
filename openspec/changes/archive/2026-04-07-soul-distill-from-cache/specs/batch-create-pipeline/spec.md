## MODIFIED Requirements

### Requirement: Batch capture→distill data handoff
Batch pipeline SHALL 将 capture 返回的 `sessionDir` 传递给 `distillSoul`，而非空的 `capturedChunks`。

#### Scenario: Web-search capture 完成后调用 distill
- **WHEN** batch pipeline 中单个 soul 的 capture 完成
- **AND** `result.sessionDir` 可用
- **THEN** SHALL 调用 `distillSoul(name, soulDir, config, { sessionDir: result.sessionDir, onProgress })`
- **AND** SHALL 不再构建 `capturedChunks: SoulChunk[]`

#### Scenario: Capture 返回 UNKNOWN_ENTITY
- **WHEN** capture 返回 `UNKNOWN_ENTITY`
- **THEN** SHALL 标记该 soul 为 failed（现有行为不变）

#### Scenario: Synthetic chunks 处理
- **WHEN** batch pipeline 创建 synthetic chunks
- **THEN** SHALL 将 synthetic chunks 作为额外 `chunks` 传给 distillSoul
- **AND** distillSoul 的 sampleChunks SHALL 合并 sessionDir 数据和 chunks 数据

### Requirement: BatchPipelineDeps 类型更新
`BatchPipelineDeps.distillSoul` 签名 SHALL 与新的 `distillSoul` options object 签名对齐。

#### Scenario: 类型签名变更
- **WHEN** batch pipeline 调用 `deps.distillSoul`
- **THEN** SHALL 使用新签名 `distillSoul(name, soulDir, config, options)`
- **AND** `options` SHALL 支持 `sessionDir` 和 `chunks` 参数
