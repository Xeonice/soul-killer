## Context

当前 `tests/unit/` 有 61 个测试文件全部平铺，`tests/component/` 有 22 个文件平铺。源码在 `src/` 下有清晰的分层目录（`cli/`, `config/`, `export/`, `infra/`, `soul/`, `world/`），但测试目录不反映这个结构，依赖文件名前缀（如 `export-state-*`, `world-*`）来隐式分组。

vitest 配置已使用 `tests/unit/**/*.test.ts` glob 模式，天然兼容子目录。

## Goals / Non-Goals

**Goals:**
- 测试文件目录结构 1:1 镜像源码目录结构
- 修改 `src/X/Y/Z.ts` 后，可直接定位到 `tests/unit/X/Y/Z.test.ts`
- 消除文件名前缀约定，用目录层次替代

**Non-Goals:**
- 不改变测试内容、断言逻辑
- 不调整 unit/component/integration/e2e 的分类边界（component 中命令流程测试是否应改分类是独立讨论）
- 不重命名测试文件本身（只移动位置，去掉冗余前缀）
- 不修改 vitest 配置（已兼容）
- 不动 e2e/integration/visual 目录

## Decisions

### 1. 目录镜像策略

测试路径 = `tests/{unit|component}/` + 源码在 `src/` 下的相对路径（目录部分）+ 测试文件名。

例如：
```
src/export/state/apply.ts      → tests/unit/export/state/apply.test.ts
src/infra/search/exa-search.ts → tests/unit/infra/search/exa-search.test.ts
src/world/chronicle.ts         → tests/unit/world/chronicle.test.ts
```

**文件名去前缀规则**：当前缀与目录路径重复时去掉。例如 `export-state-apply.test.ts` 移入 `export/state/` 后变为 `apply.test.ts`。但如果文件名本身不含冗余前缀（如 `glitch-engine.test.ts`），保留原名。

### 2. 特殊映射

| 当前测试文件 | 源码位置 | 目标路径 |
|-------------|---------|---------|
| `acceptance-*.test.ts` (2) | `acceptance/` (项目根目录) | `tests/unit/acceptance/` |
| `dimensions.test.ts` | `src/soul/capture/soul-dimensions.ts` | `tests/unit/soul/capture/dimensions.test.ts` |
| `distill-progress.test.ts` | `src/soul/distill/extractor.ts` | `tests/unit/soul/distill/distill-progress.test.ts` |
| `export.test.ts` | `src/soul/package.ts` | `tests/unit/soul/package.test.ts` |
| `export-tools.test.ts` | `src/soul/package.ts` (packageSoul) | `tests/unit/soul/package-tools.test.ts` |
| `tag-parser.test.ts` | `src/soul/tags/taxonomy.ts` | `tests/unit/soul/tags/parser.test.ts` |
| `soul-resolver.test.ts` | `src/cli/soul-resolver.ts` | `tests/unit/cli/soul-resolver.test.ts` |
| `path-resolver.test.ts` | `src/cli/path-resolver.ts` | `tests/unit/cli/path-resolver.test.ts` |
| `temporal-extraction.test.ts` | `src/infra/ingest/markdown-adapter.ts` | `tests/unit/infra/ingest/temporal-extraction.test.ts` |
| `search-dedup.test.ts` | `src/infra/agent/tools/` | `tests/unit/infra/agent/tools/search-dedup.test.ts` |
| `prose-style-patterns.test.ts` | `src/export/support/` | `tests/unit/export/support/prose-style-patterns.test.ts` |

### 3. component 目录子目录划分

按源码位置分为三组：
```
tests/component/
├── animation/     ← src/cli/animation/ 对应
├── components/    ← src/cli/components/ 对应
└── commands/      ← src/cli/commands/ 对应
    ├── export/
    ├── soul/
    ├── system/
    └── world/
```

Snapshot 文件（`__snapshots__/`）跟随测试文件移入对应子目录。

### 4. import 路径更新策略

移入子目录后，相对路径深度增加。例如从 `tests/unit/` 移到 `tests/unit/export/state/`，`../../src/` 变为 `../../../../src/`。用脚本批量更新。

### 5. 一次性 git mv，保留历史

使用 `git mv` 移动文件（而非 delete + create），确保 `git log --follow` 能追溯历史。

## Risks / Trade-offs

| 风险 | 缓解 |
|------|------|
| git blame 被 rename 打断 | `git log --follow` / `git blame -C` 可追溯；这是一次性成本 |
| import 路径批量更新可能出错 | 移动后立即 `bun run test` 验证全部通过 |
| 与现有 PR 冲突 | 在没有活跃 PR 时执行此变更 |
| 目录层级过深 | 最深 4 层（`tests/unit/export/state/apply.test.ts`），可接受 |
