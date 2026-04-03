## 1. 标签体系基础设施

- [x] 1.1 创建 `src/tags/taxonomy.ts` — 定义 TagCategory 枚举、TagSet 类型、5 个分类的预置锚点标签
- [x] 1.2 创建 `src/tags/parser.ts` — 实现 `parseTags(input: string, config): Promise<TagSet>`，通过 LLM 从自然语言提取结构化标签
- [x] 1.3 为标签解析编写单元测试 `tests/unit/tag-parser.test.ts`

## 2. 创建流程状态机重构

- [x] 2.1 在 `src/cli/commands/create.tsx` 中新增 `SoulType` 类型 (`personal` | `public`) 和 `type-select` 步骤
- [x] 2.2 实现类型选择 UI 组件（两个选项：个人灵魂 / 公开灵魂）
- [x] 2.3 新增 `description` 步骤 — Q2 一句话描述输入（支持回车跳过）
- [x] 2.4 新增 `tags` 步骤 — Q3 标签/印象输入（支持回车跳过），调用 `parseTags` 解析
- [x] 2.5 新增 `confirm` 步骤 — 展示信息汇总，支持确认/修改
- [x] 2.6 重构状态机流转逻辑：个人灵魂跳过 capturing 步骤，公开灵魂保留 capturing 步骤
- [x] 2.7 使 `data-sources` 步骤在两条路径中都可选（新增"跳过"选项）

## 3. Agent 搜索适配

- [x] 3.1 修改 `captureSoul()` 签名，新增可选 `hint?: string` 参数
- [x] 3.2 将 hint 拼接到 ROUND1_PROMPT 中，辅助分类和搜索消歧义
- [x] 3.3 在 create.tsx 中仅当 `soulType === 'public'` 时调用 `captureSoul()`，传入 Q2 描述作为 hint

## 4. 合成 Chunks 与纯描述蒸馏

- [x] 4.1 创建 `src/ingest/synthetic-adapter.ts` — 将用户描述和标签转化为 SoulChunk 对象（source: 'user-input'）
- [x] 4.2 修改 `src/distill/extractor.ts` — 接收可选 `tags: TagSet` 参数，将标签注入提取 prompt
- [x] 4.3 修改 `src/distill/sampler.ts` — 当 chunks 数量 ≤ 2 时跳过采样直接使用全部 chunks
- [x] 4.4 在 create.tsx 中合并合成 chunks 与真实数据 chunks 后统一传入蒸馏管线

## 5. Soul Package 扩展

- [x] 5.1 修改 `src/soul/package.ts` — manifest schema 新增 `soulType` 和 `tags` 字段
- [x] 5.2 在 `generateManifest()` 中填充新字段，向后兼容处理（缺失时用默认值）

## 6. 测试与验证

- [x] 6.1 编写 create 命令组件测试 — 覆盖个人灵魂完整流程（类型选择 → 名字 → 描述 → 标签 → 跳过数据源 → 蒸馏）
- [x] 6.2 编写 create 命令组件测试 — 覆盖公开灵魂完整流程（类型选择 → 名字 → 描述 → 标签 → Agent 搜索 → 蒸馏）
- [x] 6.3 编写集成测试 — 纯描述创建个人灵魂端到端（无数据源，仅凭 Q2+Q3 生成灵魂文件）
