## Why

当前 `/create` 流程对所有目标统一执行在线搜索，存在两个问题：对于私人对象（用户认识的人），搜索会浪费时间甚至引入同名错误数据；对于公开对象（名人/虚构角色），缺少用户 hint 导致搜索可能命中错误目标。此外，创建流程要求用户必须提供文档数据才能完成，门槛过高——实际上仅凭简短描述和标签就应能生成可用灵魂。

## What Changes

- 新增前置灵魂类型选择（个人灵魂 / 公开灵魂），决定后续数据采集策略
- 用轻量 3 问录入替代当前的单一名字输入：名字 → 一句话描述 → 一句话标签/印象
- 新增全局标签体系（性格内核、沟通风格、价值取向、行为模式、领域标签），贯穿创建、蒸馏、产物、纠正全流程
- 个人灵魂跳过在线搜索，以标签+描述为主、数据源为可选增强
- 公开灵魂保留 Agent 搜索，但新增用户描述作为搜索 hint（消歧义+定向）
- "仅凭描述生成"成为合法路径——无数据源也能完成创建
- **BREAKING**: `CreateStep` 状态机重构，新增 `type-select`、`description`、`tags` 步骤

## Capabilities

### New Capabilities
- `soul-type-system`: 灵魂类型分类体系（个人/公开），决定创建流程分支和数据采集策略
- `soul-tag-system`: 全局标签体系基础设施——标签分类定义、标签解析（从自然语言提取）、标签存储（写入 manifest/persona 元数据）
- `lightweight-intake`: 轻量录入流程——3 问模型（名字+描述+标签），自然语言输入由系统解析为结构化数据

### Modified Capabilities
- `soul-capture-agent`: Agent 搜索现在接收用户描述作为 hint，并且仅在公开灵魂类型下触发
- `soul-distill`: 蒸馏流程需要消费标签数据，用标签引导 LLM 提取方向；支持无数据源的纯描述蒸馏
- `soul-package`: manifest.json 新增 `soulType`、`tags` 字段

## Impact

- `src/cli/commands/create.tsx` — 状态机重构，新增多个步骤
- `src/agent/soul-capture-agent.ts` — 接收描述 hint 参数，条件触发
- `src/distill/extractor.ts` — 消费标签数据，支持无 chunk 的纯描述模式
- `src/distill/generator.ts` — 标签写入生成的 identity/style 文件
- `src/soul/package.ts` — manifest schema 扩展
- 新增 `src/tags/` 模块 — 标签定义、解析、存储
- `src/ingest/types.ts` — 可能需要扩展 SoulChunk 以承载描述/标签来源的 chunks
