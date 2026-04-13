## MODIFIED Requirements

### Requirement: release workflow 覆盖式发布

`release.yml` SHALL 在创建 GitHub Release 前先删除同名已有 release，确保同 tag 重推时不会失败。

#### Scenario: 同 tag 重新推送

- **WHEN** v0.3.0 tag 重新推送，旧的 v0.3.0 Release 已存在
- **THEN** SHALL 先删除旧 Release，再创建新 Release 并上传所有产物

### Requirement: checksums.txt 上传至 R2 CDN

`release.yml` SHALL 将 `dist/checksums.txt` 上传到 R2 的 `releases/<version>/checksums.txt` 和 `releases/latest/checksums.txt`。

#### Scenario: checksums 可通过 CDN 访问

- **WHEN** release 完成后
- **THEN** `https://soulkiller-download.../releases/latest/checksums.txt` SHALL 返回最新构建的 checksums 内容
