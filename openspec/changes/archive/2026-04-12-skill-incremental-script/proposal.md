## Why

Phase 1 当前要求 LLM 在一次 Write 调用中产出完整的 script.json（50KB+）。这导致两个问题：

1. **JSON 语法错误无法隔离**：中文叙事文本中未转义的 ASCII 双引号导致整个 JSON 报废，需要全部重来。已在 Fate Zero skill 中实际发生。
2. **连贯性随规模退化**：LLM 脑内同时持有 50KB+ JSON，生成后段场景时对前段的记忆衰减，叙事连贯性下降。随着场景数增长，这个问题只会加重。

此外，AskUserQuestion 的 options 上限为 4 个，当前 SKILL.md 要求每个场景 choices + 📊 + 💾 容易超限。

## What Changes

### 核心：Phase 1 从单次 Write 改为 Plan + Build 增量模式

- 新增 `state script plan` 子命令：接收叙事蓝图（schema + scene outlines + character arcs + endings），验证结构并持久化到 `.build-<id>/plan.json`
- 新增 `state script scene` 子命令：接收单个场景 JSON（text + choices），验证 JSON 语法 + 语义一致性（consequences ⊂ schema, next ∈ known scenes），持久化到 `.build-<id>/scenes/<scene-id>.json`
- 新增 `state script build` 子命令：合并 plan + scenes 为完整 `script-<id>.json`，全量验证，清理 build 目录
- 重写 SKILL.md Phase 1 流程：Step A (Plan) → Step B (逐场景 Generate) → Step C (Build) → Step D (精简 Self-check)

### 附带修复：AskUserQuestion options 限制

- SKILL.md 要求每个场景最多 2 个 choices，留 2 个给系统选项（📊 + 💾），总计不超过 4 个

## Capabilities

### New Capabilities

- `script-builder`: state script 子命令（plan / scene / build），增量构建 + 验证 script.json

### Modified Capabilities

- `skill-runtime-state`: main.ts 注册 script 子命令命名空间
- `state-schema`: SKILL.md Phase 1 流程重写为增量模式，Phase 2 choices 限制为 ≤2

## Impact

- **新文件**：`src/export/state/script-builder.ts`（plan/scene/build 逻辑）
- **修改文件**：`src/export/state/main.ts`（注册子命令）、`src/export/spec/skill-template.ts`（Phase 1 重写 + Phase 2 choices 限制）
- **运行时产物**：`.build-<id>/` 临时目录（build 后自动清理）
- **测试**：新增 script-builder.test.ts
