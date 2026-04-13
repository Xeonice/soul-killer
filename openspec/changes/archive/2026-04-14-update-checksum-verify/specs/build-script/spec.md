## MODIFIED Requirements

### Requirement: 构建流程生成 checksums.txt

`build.ts` SHALL 在 Phase 3（压缩归档）之前，计算所有已编译二进制的 sha256 并写入 `dist/checksums.txt`。

#### Scenario: checksums 在归档前生成

- **WHEN** Phase 2（交叉编译）完成后
- **THEN** SHALL 遍历所有 `soulkiller-<platform>` 二进制文件，计算 sha256，写入 `dist/checksums.txt`
