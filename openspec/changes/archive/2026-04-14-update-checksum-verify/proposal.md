## Why

`soulkiller --update` 仅通过版本号判断是否需要更新。当同一版本号（如 v0.3.0）重新发布了不同的二进制时（修 bug 后重新打 tag），updater 比较版本号相同就跳过，用户无法获取修复后的二进制。需要基于文件内容 hash 来判断是否需要更新。

## What Changes

- **构建时生成 checksums.txt**：`build.ts` 在压缩归档前计算每个平台解压后二进制的 sha256，写入 `dist/checksums.txt`
- **CI 上传 checksums.txt**：`release.yml` 将 checksums.txt 随其他产物一起上传到 GitHub Release 和 R2 CDN
- **updater 基于 hash 判断**：`--update` 从 CDN 下载 checksums.txt，计算本地二进制 sha256，不同则更新（无论版本号是否相同）
- **release.yml 覆盖式发布**：同一 tag 重新推送时先删旧 release 再创建，避免 CI 失败

## Capabilities

### New Capabilities

- `update-checksum`: 基于 sha256 校验的二进制更新检测机制

### Modified Capabilities

- `self-update`: updater 从纯版本号比对改为 hash + 版本号双重判断
- `build-script`: 构建流程新增 checksums.txt 生成步骤
- `release-ci`: release workflow 支持覆盖式发布

## Impact

- 文件变更：`src/cli/updater.ts`、`scripts/build.ts`、`.github/workflows/release.yml`
- 新增产物：`dist/checksums.txt`（随 release 分发）
- R2 CDN 新增文件：`releases/latest/checksums.txt`
- 向后兼容：旧版二进制的 updater 不识别 checksums.txt，仍走版本号比对逻辑
