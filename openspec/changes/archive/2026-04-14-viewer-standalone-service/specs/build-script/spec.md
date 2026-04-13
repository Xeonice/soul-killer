## MODIFIED Requirements

### Requirement: 归档包含 viewer 静态文件

build.ts SHALL 在压缩阶段将 `packages/viewer/dist/` 内容作为 `viewer/` 目录打入 tar.gz/zip 归档。不再生成 barrel 模块。

#### Scenario: 归档包含 viewer 目录

- **WHEN** `bun run build:release` 成功执行
- **THEN** 每个平台的归档 SHALL 包含 `soulkiller` 二进制和 `viewer/` 目录

#### Scenario: 删除 Phase 0.5

- **WHEN** 构建流程执行
- **THEN** SHALL 不生成 `viewer-bundle.ts`
