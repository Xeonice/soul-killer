### Requirement: distillSoul 支持 sessionDir 数据源
`distillSoul` SHALL 接受 options object，支持 `sessionDir`（web-search）和 `chunks`（local source）两种数据路径。

#### Scenario: web-search 路径传入 sessionDir
- **WHEN** `distillSoul` 被调用且 `sessionDir` 已提供
- **THEN** SHALL 注册 `listArticles` 和 `readArticle` tools（不注册 sampleChunks）
- **AND** system prompt SHALL 引导 agent 使用 listArticles → readArticle 工作流

#### Scenario: local source 路径传入 chunks
- **WHEN** `distillSoul` 被调用且 `chunks` 已提供但 `sessionDir` 未提供
- **THEN** SHALL 注册 `sampleChunks` tool（不注册 listArticles/readArticle）
- **AND** system prompt SHALL 引导 agent 使用 sampleChunks 工作流（现有行为不变）

#### Scenario: sessionDir 和 chunks 都未提供
- **WHEN** `distillSoul` 被调用且两者都未提供
- **THEN** SHALL 抛出错误

### Requirement: listArticles tool
`listArticles` SHALL 返回文章轻量列表，供 agent 浏览数据全貌。

#### Scenario: 按维度列出文章
- **WHEN** agent 调用 `listArticles({ dimension: "identity" })`
- **THEN** SHALL 从文章索引中过滤该维度的文章
- **AND** 每条返回 `{ index, title, url, dimension, charCount, preview }` 其中 preview 为前 200 chars

#### Scenario: 列出全部文章
- **WHEN** agent 调用 `listArticles()` 不传 dimension
- **THEN** SHALL 返回所有维度的全部文章列表
- **AND** 按维度分组排列

#### Scenario: 维度不存在
- **WHEN** agent 调用 `listArticles({ dimension: "xxx" })` 且该维度无文章
- **THEN** SHALL 返回空数组

### Requirement: readArticle tool
`readArticle` SHALL 按索引读取单篇文章内容，供 agent 深度阅读。

#### Scenario: 正常读取
- **WHEN** agent 调用 `readArticle({ index: 5 })`
- **THEN** SHALL 返回 `{ title, url, content, dimension, charCount, truncated }`
- **AND** content SHALL 截断到 8000 chars
- **AND** 如果原文超过 8000 chars，`truncated` SHALL 为 true

#### Scenario: 索引越界
- **WHEN** agent 调用 `readArticle({ index: 999 })` 且索引超出范围
- **THEN** SHALL 返回错误信息 `{ error: "Article index out of range" }`

### Requirement: 文章索引预构建
distillSoul 在 sessionDir 路径启动时 SHALL 预先构建文章索引。

#### Scenario: 索引构建
- **WHEN** distillSoul 以 sessionDir 路径启动
- **THEN** SHALL 读取 sessionDir 下所有 `.json` 文件
- **AND** 为每篇文章生成 `{ index, title, url, dimension, charCount }` 条目
- **AND** 文章按维度分组、在组内按 `_score`（如有）降序排列

### Requirement: distillSoul 签名使用 options object
`distillSoul` SHALL 使用 options object 替代位置参数。

#### Scenario: options object 结构
- **WHEN** 调用 `distillSoul`
- **THEN** 签名 SHALL 为 `distillSoul(name, soulDir, config, options)`
- **AND** options SHALL 包含: `sessionDir?: string`, `chunks?: SoulChunk[]`, `tags?: TagSet`, `onProgress?: OnDistillAgentProgress`, `agentLog?: AgentLogger`

### Requirement: system prompt 动态适配
`buildDistillPrompt` SHALL 根据数据源生成不同的工作流建议。

#### Scenario: sessionDir 路径 prompt
- **WHEN** 数据源为 sessionDir
- **THEN** system prompt SHALL 建议 agent 先 listArticles 浏览各维度 → readArticle 按需深读 → 写文件
- **AND** SHALL 说明每篇文章可能被截断

#### Scenario: chunks 路径 prompt
- **WHEN** 数据源为 chunks
- **THEN** system prompt SHALL 保留现有 sampleChunks 工作流建议不变
