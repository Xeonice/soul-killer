## MODIFIED Requirements

### Requirement: --update 基于 hash 检测更新

`soulkiller --update` SHALL 下载 checksums.txt，计算本地二进制 sha256，通过 hash 比对判断是否需要更新。版本号比对作为 checksums.txt 不可用时的 fallback。

#### Scenario: 同版本但 hash 不同（重发）

- **WHEN** 远端版本号与本地相同，但 checksums.txt 中对应平台的 hash 与本地二进制 hash 不同
- **THEN** SHALL 下载并替换二进制

#### Scenario: 同版本且 hash 相同

- **WHEN** 远端版本号与本地相同，且 hash 一致
- **THEN** SHALL 输出"Already up to date"并跳过

#### Scenario: checksums.txt 不可用时 fallback

- **WHEN** CDN 和 GitHub 均无法获取 checksums.txt
- **THEN** SHALL fallback 到纯版本号比对逻辑
