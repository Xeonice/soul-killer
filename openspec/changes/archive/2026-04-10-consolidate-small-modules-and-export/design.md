## Context

上一轮重构建立了领域驱动目录（soul/, world/, export/, infra/），但顶层仍残留 6 个微模块。export/ 内部 29 个文件缺乏层次感。

## Goals / Non-Goals

**Goals:**
- src/ 顶层从 12 个目录缩减到 6 个
- tags 按领域拆分到 soul/tags 和 world/tags
- export/ 内部按三层分离：流程编排、产物定义、辅助工具
- pack/ 归入 export/ 领域

**Non-Goals:**
- 不动 config/（它是用户配置，不是基础设施）
- 不动 export/state/（独立运行时，保持不变）
- 不动 export/agent/（上轮已拆分好）

## Decisions

### 1. 目标目录结构

```
src/
├── cli/                           ← 不动
├── soul/
│   ├── tags/                      ← 从 tags/ 拆入 (taxonomy.ts, parser.ts)
│   ├── capture/                   ← 不动
│   ├── distill/                   ← 不动
│   └── ...
├── world/
│   ├── tags/                      ← 从 tags/ 拆入 (world-taxonomy.ts)
│   ├── capture/                   ← 不动
│   └── ...
├── export/
│   ├── agent/                     ← 层级 1: 流程编排（不动）
│   ├── spec/                      ← 层级 2: 产物定义（新建）
│   │   ├── skill-template.ts      ← 从 export/ 顶层迁入
│   │   └── story-spec.ts          ← 从 export/ 顶层迁入
│   ├── support/                   ← 层级 3: 辅助工具（合并 lint+prose-style+format）
│   │   ├── lint-skill-template.ts ← 从 lint/ 迁入
│   │   ├── lint-index.ts          ← 从 lint/index.ts 迁入
│   │   ├── zh-translatese-patterns.ts ← 从 prose-style/ 迁入
│   │   ├── prose-style-index.ts   ← 从 prose-style/index.ts 迁入
│   │   ├── skill-slug.ts          ← 从 format/ 迁入
│   │   └── format-index.ts        ← 从 format/index.ts 迁入
│   ├── pack/                      ← 从 src/pack/ 迁入
│   │   ├── packer.ts
│   │   ├── unpacker.ts
│   │   ├── meta.ts
│   │   └── checksum.ts
│   ├── packager.ts                ← 留顶层（zip 打包桥梁）
│   └── state/                     ← 不动
│
├── infra/
│   ├── agent/                     ← 不动
│   ├── search/                    ← 不动
│   ├── ingest/                    ← 不动
│   ├── llm/                       ← 从 src/llm/ 迁入
│   ├── engine/                    ← 从 src/engine/ 迁入
│   ├── i18n/                      ← 从 src/i18n/ 迁入（含 locales/）
│   ├── utils/                     ← 从 src/utils/ 迁入
│   └── ...
│
└── config/                        ← 不动（用户配置，不归 infra）
```

### 2. export/support/ 合并策略

lint/, prose-style/, format/ 各有 index.ts 做 re-export。合并后保留原文件名避免命名冲突：
- `lint/index.ts` → `support/lint-index.ts`
- `lint/lint-skill-template.ts` → `support/lint-skill-template.ts`
- `prose-style/index.ts` → `support/prose-style-index.ts`
- `prose-style/zh-translatese-patterns.ts` → `support/zh-translatese-patterns.ts`
- `format/index.ts` → `support/format-index.ts`
- `format/skill-slug.ts` → `support/skill-slug.ts`

### 3. tags 拆分

- `tags/taxonomy.ts` + `tags/parser.ts` → `soul/tags/`（主要被 soul 领域使用，world 的少量引用通过 `../../soul/tags/` 跨域访问）
- `tags/world-taxonomy.ts` → `world/tags/world-taxonomy.ts`

### 4. i18n 含 locales/ 子目录

`i18n/` 包含 `index.ts` + `locales/{zh,en,ja}.json`，整体迁入 `infra/i18n/`。

## Risks / Trade-offs

- **[Trade-off] soul/tags/taxonomy.ts 被 world/ 和 infra/ 也引用** → 这些是类型/工具引用（emptyTagSet, TagSet 类型），从 soul/ 跨域引用是合理的，因为 TagSet 确实是 soul 领域定义的概念，world 只是消费它。
- **[Trade-off] export/support/ 文件名带原目录前缀** → 避免合并后 3 个 index.ts 冲突，虽然名字长但职责清晰。
- **[Risk] i18n locales/ 是 JSON 文件** → 迁移时需要连同 JSON 一起移动。
