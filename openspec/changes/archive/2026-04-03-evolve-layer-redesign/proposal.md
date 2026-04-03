## Why

现有 `/evolve` 命令只是一个"喂 markdown 路径 → 全量重蒸馏"的简单管道，无法满足分身创建后持续补充和精炼的需求。Soul 的数据应该像人的记忆一样可以渐进式积累——从对话反馈、新的文章、网页信息、甚至直接的人工修正中不断丰富。当前的全量重蒸馏不仅浪费 token，还会导致已经手动调优过的 soul 文件被覆盖。

## What Changes

- **多源数据补充**：evolve 支持 markdown、URL/网页、对话反馈、直接文本输入等多种数据源，而非仅限 markdown 路径
- **增量蒸馏（delta distill）**：新数据仅提取增量特征，与现有 soul 文件合并，而非全量覆盖重建
- **Soul 文件版本快照**：每次 evolve 前自动备份当前 soul 文件，支持回滚到任意历史版本
- **数据源审查（data audit）**：`/evolve status` 子命令显示当前 soul 的数据构成——多少 chunks 来自哪些源、上次蒸馏时间、数据覆盖度
- **选择性更新**：允许用户指定仅更新 identity / style / behaviors 中的某一类，避免无关部分被干扰
- **对话反馈回流**：在对话中用 `/feedback` 标记"这个回答很像/不像本人"，反馈作为 synthetic chunk 回流到 evolve 管道

- **Chunk 时间元信息增强**：各适配器改进时间提取能力——markdown 尝试从 frontmatter/文件名解析日期，web 提取发布时间，所有 chunk 新增 `temporal` 元信息字段标记时间置信度，为未来 era 时间切面做前置准备

## Capabilities

### New Capabilities
- `evolve-multi-source`: Evolve 命令支持多种数据源输入（markdown、URL、text、conversation feedback），统一进入 ingest 管道
- `delta-distill`: 增量蒸馏引擎——仅对新 chunks 提取特征，与现有 soul 文件做 LLM 辅助合并而非全量覆盖
- `soul-snapshot`: Soul 文件版本快照系统——evolve 前自动备份，支持 `/evolve rollback` 回退
- `evolve-audit`: 数据审查子命令，展示 soul 的数据构成和蒸馏历史
- `conversation-feedback`: 对话中 `/feedback` 命令标记回答质量，反馈数据回流至 evolve 管道
- `chunk-temporal-metadata`: Chunk 时间元信息增强——各适配器改进时间提取，新增 temporal 置信度标记

### Modified Capabilities
- `evolve-command`: 从单一 markdown 路径输入改为多源选择式交互流程，新增子命令（status/rollback）
- `data-ingest`: 新增 URL 直接输入作为 ingest 源（复用 web-adapter 的页面提取能力，无需 agent 搜索）；SourceType 新增 `'feedback'`；SoulChunk 新增可选 `temporal` 字段
- `soul-distill`: 支持增量模式——接收现有 soul 文件内容作为上下文，输出 delta 而非全量

## Impact

- `src/cli/commands/evolve.tsx` — 重写，从单步骤改为多源选择 + 子命令路由
- `src/cli/commands/feedback.tsx` — 新增，对话中标记回答质量的交互命令
- `src/cli/app.tsx` — 路由新增 evolve 子命令和 /feedback 命令处理；对话状态扩展 feedback 存储
- `src/distill/` — 新增 `merger.ts`（soul 文件合并逻辑）
- `src/ingest/types.ts` — SoulChunk 新增 `temporal` 可选字段；SourceType 新增 `'feedback'`
- `src/ingest/url-adapter.ts` — 新增，直接从 URL 提取内容为 chunks
- `src/ingest/feedback-adapter.ts` — 新增，对话反馈转 SoulChunk
- `src/ingest/markdown-adapter.ts` — 增强时间提取（frontmatter date、文件名日期模式）
- `src/ingest/web-adapter.ts` — 增强时间提取（发布日期元数据）
- `src/soul/` — 新增 `snapshot.ts`（版本快照管理）、manifest 扩展 evolve 历史记录
- `~/.soulkiller/souls/<name>/` — 目录结构新增 `snapshots/`、`feedback.json`
