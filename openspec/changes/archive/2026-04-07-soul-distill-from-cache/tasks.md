## 1. distillSoul 签名重构（已完成）

- [x] 1.1 将 `distillSoul` 签名从位置参数改为 options object：`distillSoul(name, soulDir, config, { sessionDir?, chunks?, tags?, onProgress?, agentLog? })`
- [x] 1.2 更新 `create.tsx` 所有 `distillSoul` 调用点适配新签名
- [x] 1.3 更新 `batch-pipeline.ts` 的 `BatchPipelineDeps.distillSoul` 类型签名和调用

## 2. create.tsx capture 后状态管理（已完成）

- [x] 2.1 新增 state：`agentSessionDir`、`capturedDimensions`、`dimBreakdown`
- [x] 2.2 在 `runAgentCapture` 的 capture 完成后，保存 sessionDir/dimensionPlan/dimensionScores 到 state
- [x] 2.3 更新 distill 调用路径：web-search 时传 sessionDir，local-only 时传 chunks

## 3. search-confirm UI 对齐 World（已完成）

- [x] 3.1 将 search-confirm 片段展示从 `agentChunks.length` 改为 `chunkCount`
- [x] 3.2 新增维度质量条形图展示（dimBreakdown + capturedDimensions）
- [x] 3.3 简化 search-confirm 选项为 confirm/retry 两项（移除 detail）

## 4. distill-agent.ts 签名与数据源路由

- [x] 4.1 在 `distill-agent.ts` 中实现 options object 签名、数据源校验（sessionDir/chunks 至少提供一个）
- [x] 4.2 构建文章索引：sessionDir 路径启动时读取所有维度 JSON，生成 `articleIndex[]`（index, title, url, dimension, charCount），按维度分组、组内按 _score 降序

## 5. listArticles + readArticle tools

- [x] 5.1 实现 `listArticles` tool：参数 `dimension?`，返回 `{ index, title, url, dimension, charCount, preview(200 chars) }[]`
- [x] 5.2 实现 `readArticle` tool：参数 `index`，返回 `{ title, url, content(截到 8000 chars), dimension, charCount, truncated }`，索引越界返回错误
- [x] 5.3 tool 注册路由：sessionDir 路径注册 listArticles + readArticle（不注册 sampleChunks），chunks 路径注册 sampleChunks（不注册 listArticles/readArticle）

## 6. system prompt 动态适配

- [x] 6.1 拆分 `buildDistillPrompt` 为双模式：sessionDir 路径引导 listArticles → readArticle → write 工作流，chunks 路径保留现有 sampleChunks 工作流
- [x] 6.2 sessionDir 模式 prompt 需说明文章可能被截断、agent 应优先读高优先级维度

## 7. 验证

- [x] 7.1 `bun run build` 类型检查通过
- [x] 7.2 `bun run test` 单元测试通过 — 63 files / 558 tests
- [x] 7.3 手动测试：创建诸葛亮 soul，验证 search-confirm 显示正确片段数和维度质量
- [x] 7.4 手动测试：验证 distill 阶段 listArticles/readArticle 正常工作，不爆上下文
