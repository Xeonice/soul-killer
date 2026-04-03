## 1. Chunk 时间元信息增强

- [x] 1.1 扩展 `src/ingest/types.ts` — SoulChunk 新增可选 `temporal` 字段（`{ date?, period?, confidence: 'exact' | 'inferred' | 'unknown' }`）；SourceType 新增 `'feedback'`
- [x] 1.2 改进 `src/ingest/markdown-adapter.ts` — 按优先级提取时间：frontmatter `date` → 文件名日期模式（`YYYY-MM-DD-*.md`）→ mtime，填充 `temporal` 字段
- [x] 1.3 改进 `src/ingest/twitter-adapter.ts` — 从 tweet `created_at` 填充 `temporal: { date, confidence: 'exact' }`
- [x] 1.4 改进 `src/ingest/web-adapter.ts` — 提取 `article:published_time` meta 标签或 `<time>` 元素，填充 `temporal`
- [x] 1.5 为各适配器的 temporal 提取编写单元测试（frontmatter 解析、文件名模式、web meta 提取、无时间兜底）

## 2. 数据适配器扩展

- [x] 2.1 新增 `src/ingest/url-adapter.ts` — URL 适配器，复用 Readability + Turndown 提取网页内容为 SoulChunk[]，含 temporal 提取
- [x] 2.2 新增 `src/ingest/text-adapter.ts` — 纯文本输入适配器，将用户输入文本按段落拆分为 SoulChunk[]
- [x] 2.3 新增 `src/ingest/feedback-adapter.ts` — 对话反馈适配器，读取 feedback.json 中未消费记录转为 SoulChunk[]，处理后标记 `consumed: true`
- [x] 2.4 为 url-adapter、text-adapter、feedback-adapter 编写单元测试

## 3. 对话反馈系统

- [x] 3.1 新增 `src/cli/commands/feedback.tsx` — `/feedback` 命令组件：评分选择（很像/基本像/不太像/完全不像）+ 可选文字说明
- [x] 3.2 实现 feedback 持久化 — 写入 `~/.soulkiller/souls/<name>/feedback.json`（append 模式，含 consumed 字段）
- [x] 3.3 扩展 `src/cli/app.tsx` — 注册 `/feedback` 命令路由，传入最近一条对话消息上下文
- [x] 3.4 扩展 `src/cli/command-registry.ts` — 注册 `/feedback` 命令及描述
- [x] 3.5 为 feedback 命令编写组件测试

## 4. Soul 快照系统

- [x] 4.1 新增 `src/soul/snapshot.ts` — 快照创建（复制 soul/ 到 snapshots/<timestamp>/）、列表、删除、恢复功能
- [x] 4.2 实现快照保留策略 — 最多 10 个快照，超出自动清理最旧
- [x] 4.3 快照 meta 文件 — `snapshot-meta.json` 包含时间戳、原因、当时 chunk 数
- [x] 4.4 为快照系统编写单元测试（创建、列表、清理、恢复）

## 5. 增量蒸馏引擎

- [x] 5.1 扩展 `extractFeatures()` — 新增可选 `dimensions` 参数，支持选择性维度提取
- [x] 5.2 新增 `src/distill/merger.ts` — `mergeSoulFiles()` 函数，LLM 辅助合并 delta 特征与现有 soul 文件
- [x] 5.3 扩展 `generateSoulFiles()` — 新增 delta 模式参数，delta 模式下调用 merger 而非直接覆盖
- [ ] 5.4 编写 merger 的集成测试（模拟现有 soul 文件 + delta 特征的合并）

## 6. Manifest 扩展与审查

- [x] 6.1 扩展 `src/soul/manifest.ts` — SoulManifest 新增 `evolve_history` 数组字段
- [x] 6.2 新增 `appendEvolveEntry()` 工具函数 — 向 manifest 追加 evolve 历史记录
- [x] 6.3 确保 manifest 向后兼容 — 加载不含 `evolve_history` 的旧 manifest 时默认为空数组

## 7. Evolve 命令重写

- [x] 7.1 重写 `src/cli/commands/evolve.tsx` — 新交互流程：源类型选择 → 数据输入 → 维度选择 → 模式确认 → 执行
- [x] 7.2 实现源类型选择菜单组件 — markdown / url / text / feedback 四选一
- [x] 7.3 实现 URL 输入流程 — 支持逐条添加 URL，空提交结束
- [x] 7.4 实现文本输入流程 — 多行文本输入
- [x] 7.5 实现维度选择流程 — identity / style / behaviors / all 多选
- [x] 7.6 实现蒸馏模式选择 — 增量 delta / 全量 full
- [x] 7.7 集成快照 — evolve 执行前自动创建快照
- [x] 7.8 集成 manifest 更新 — evolve 完成后追加历史记录

## 8. 子命令路由

- [x] 8.1 扩展 `src/cli/app.tsx` — evolve 命令解析子命令（无参数=默认流程，status，rollback）
- [x] 8.2 实现 `/evolve status` — 展示 chunk 构成（含 temporal 分布统计）、蒸馏历史、快照数量
- [x] 8.3 实现 `/evolve rollback` — 快照列表展示 + 选择恢复

## 9. i18n 与收尾

- [x] 9.1 更新 `src/i18n/locales/{zh,en,ja}.json` — 新增 evolve、feedback、temporal 相关翻译键
- [x] 9.2 更新 `src/cli/command-registry.ts` — evolve 命令描述更新，新增 status/rollback 子命令提示
- [x] 9.3 编写 evolve 命令的组件测试（ink-testing-library 快照）
