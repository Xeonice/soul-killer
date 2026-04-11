## Why

`tests/unit/` 目录下 61 个测试文件全部平铺，使用文件名前缀（`export-*`、`world-*`）模拟分组。随着项目增长（仅 export 相关就有 15 个文件），带来两个持续恶化的问题：

1. **源码→测试映射困难**：修改 `src/infra/search/exa-search.ts` 后，无法直观找到对应测试，需要靠猜测文件名或 grep
2. **目录膨胀**：新增测试文件无明确归属，前缀约定靠人工遵守，容易不一致

## What Changes

- 将 `tests/unit/` 下的 61 个测试文件按 **源码目录镜像** 原则重组到子目录中
- 将 `tests/component/` 下的 22 个测试文件按源码归属重组到子目录中
- 更新所有被移动测试文件中的相对 import 路径
- 迁移 `tests/component/__snapshots__/` 中的快照文件到对应子目录
- vitest 配置无需修改（已使用 `**/*.test.ts` glob 模式）

## Capabilities

### New Capabilities

- `test-directory-mirror`: 测试文件按源码目录结构组织，实现路径级别的 1:1 映射

### Modified Capabilities

（无现有 spec 需要修改，本变更不涉及功能行为变化）

## Impact

- **测试文件**：61 个 unit + 22 个 component 测试文件需要移动
- **Import 路径**：所有被移动文件的相对 import 需要更新（`../../src/...` 深度变化）
- **Snapshot 文件**：约 10 个 `__snapshots__/*.snap` 文件需要迁移
- **CI**：vitest glob 模式 `tests/unit/**/*.test.ts` 天然兼容子目录，无需改动
- **Git blame**：文件 rename 会打断 blame，但 `git log --follow` 可追溯
- **CLAUDE.md**：测试目录描述需要更新
