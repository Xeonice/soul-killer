## Why

Soul 的 capture agent 已经重构为维度缓存架构（`sessionDir/*.json`），但 distill 和 UI 仍依赖旧的 `SoulChunk[]` 中间层。capture 完成后 `agentChunks` 永远为空，导致 search-confirm 显示 "片段: 0 个"，distill 收到空数据。World 侧已完成统一（`distillFromCache` 直接从缓存蒸馏），Soul 侧需要对齐。

此外，sessionDir 中存储的是完整网页文章（每篇 5K-30K chars），与旧的 SoulChunk（500-2000 chars 预分块）粒度完全不同。直接将 `sampleChunks` 指向 sessionDir 会导致单次 tool 调用返回数据量爆炸（50 篇 × 20K = ~1M chars），超出 LLM 上下文限制。需要重新设计 distill agent 的数据读取 tool 体系。

## What Changes

- **Distill agent tool 体系重设计**：用 `listArticles` + `readArticle` 替代 `sampleChunks` 作为 sessionDir 路径的数据入口。agent 先浏览文章列表（轻量），再按需逐篇深读（受控）
- `sampleChunks` 保留给 local source（SoulChunk[]）路径，不变
- `distillSoul` 签名改为 options object，支持 sessionDir 和 chunks 双路径（已完成）
- `create.tsx` capture 完成后保存 `sessionDir`、`dimensionPlan`、`dimBreakdown` 到 state（已完成，对齐 World）
- `create.tsx` 的 `search-confirm` UI 改用 `chunkCount` + `dimBreakdown` 维度质量展示（已完成，对齐 World）
- `batch-pipeline.ts` capture→distill 衔接同步更新（已完成）

## Capabilities

### New Capabilities
- `soul-distill-from-cache`: Soul distill agent 从维度缓存目录读取数据的能力。包含 `listArticles`（浏览维度文章列表）和 `readArticle`（逐篇深读）两个新 tool，以及 system prompt 适配

### Modified Capabilities
- `search-result-confirm`: search-confirm 步骤改为基于维度质量数据展示（chunkCount + dimBreakdown），不再依赖 `agentChunks.length`（已完成）
- `create-command`: capture 完成后的状态管理和 distill 调用路径变更（已完成）
- `batch-create-pipeline`: batch 模式下 capture→distill 的数据衔接从 SoulChunk[] 切到 sessionDir（已完成）

## Impact

- `src/distill/distill-agent.ts` — 签名改为 options object，新增 listArticles/readArticle tools，system prompt 更新
- `src/cli/commands/create.tsx` — state 管理、search-confirm UI、distill 调用（已完成）
- `src/agent/batch-pipeline.ts` — capture→distill 衔接（已完成）
- E2E tests — batch/create 场景可能需要更新 mock 数据
