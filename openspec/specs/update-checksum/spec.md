## ADDED Requirements

### Requirement: checksums.txt 记录每个平台二进制的 sha256

构建流程 SHALL 在所有平台二进制编译完成后，计算每个解压后二进制文件的 sha256，写入 `dist/checksums.txt`。

#### Scenario: 正常构建生成 checksums

- **WHEN** `bun scripts/build.ts` 执行成功
- **THEN** `dist/checksums.txt` SHALL 包含所有已编译平台的条目，格式为 `<sha256>  <filename>`，每行一个

#### Scenario: checksums 仅包含当前构建的平台

- **WHEN** 通过 `SOULKILLER_TARGETS` 限制构建平台为 `darwin-arm64`
- **THEN** `dist/checksums.txt` SHALL 仅包含 `soulkiller-darwin-arm64` 一行
