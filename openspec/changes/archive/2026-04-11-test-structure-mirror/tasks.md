## 1. Unit 测试文件迁移

- [x] 1.1 创建 unit 子目录结构：`cli/`, `config/`, `export/state/`, `export/support/`, `export/pack/`, `export/agent/`, `infra/agent/tools/`, `infra/ingest/`, `infra/search/`, `infra/i18n/`, `infra/utils/`, `soul/capture/`, `soul/distill/`, `soul/tags/`, `world/capture/`, `world/tags/`, `acceptance/`
- [x] 1.2 使用 `git mv` 迁移 export 相关 16 个文件到 `tests/unit/export/` 子目录，去除 `export-` 和 `export-state-` 前缀
- [x] 1.3 使用 `git mv` 迁移 world 相关 11 个文件到 `tests/unit/world/` 子目录，去除 `world-` 前缀
- [x] 1.4 使用 `git mv` 迁移 infra 相关文件（adapter, search, agent, i18n, utils）到 `tests/unit/infra/` 子目录
- [x] 1.5 使用 `git mv` 迁移 soul 相关文件到 `tests/unit/soul/` 子目录
- [x] 1.6 使用 `git mv` 迁移 cli 相关文件（command-parser, command-registry, soul-resolver, path-resolver, glitch-engine）到 `tests/unit/cli/` 子目录
- [x] 1.7 使用 `git mv` 迁移 config、acceptance、pack 相关文件到对应子目录

## 2. Component 测试文件迁移

- [x] 2.1 创建 component 子目录结构：`animation/`, `components/`, `commands/soul/`, `commands/system/`, `commands/export/`, `commands/world/`
- [x] 2.2 使用 `git mv` 迁移动画面板测试到 `tests/component/animation/`
- [x] 2.3 使用 `git mv` 迁移 UI 组件测试到 `tests/component/components/`
- [x] 2.4 使用 `git mv` 迁移命令测试到 `tests/component/commands/` 对应子目录
- [x] 2.5 迁移 `__snapshots__/` 下的 snap 文件到对应子目录的 `__snapshots__/`，删除旧的空 `__snapshots__/` 目录

## 3. Import 路径更新

- [x] 3.1 批量更新所有被移动的 unit 测试文件中的 `../../src/` 相对路径，根据新目录深度调整
- [x] 3.2 批量更新所有被移动的 component 测试文件中的相对 import 路径
- [x] 3.3 更新 component 测试文件中引用其他测试辅助模块的相对路径（如有）

## 4. 验证

- [x] 4.1 运行 `bun run test` 确认全部 unit + component 测试通过
- [x] 4.2 确认测试数量与迁移前一致（无遗漏、无多余）
- [x] 4.3 确认 `tests/unit/` 和 `tests/component/` 根目录下无残留的 `.test.ts` / `.test.tsx` 文件

## 5. 文档更新

- [x] 5.1 更新 CLAUDE.md 中的测试目录结构描述
