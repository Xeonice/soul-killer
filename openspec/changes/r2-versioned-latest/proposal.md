## Why

三个问题：

1. CI R2 上传失败——wrangler 在 CI 里调 `/memberships` 报错（需要 `CLOUDFLARE_ACCOUNT_ID` 环境变量）
2. Worker 每次下载都要调 GitHub API 查 latest 版本号，增加了外部依赖和延迟
3. R2 路径没有 `latest/` 别名，安装脚本的下载链路依赖 GitHub API 可用性

## What Changes

### 1. R2 路径结构改为 versioned + latest

CI 每次 release 上传两份：
- `releases/<tag>/soulkiller-darwin-arm64.tar.gz` — 版本归档
- `releases/latest/soulkiller-darwin-arm64.tar.gz` — 最新版（每次覆盖）

### 2. Worker 简化

`/download/:platform` 直接从 R2 `releases/latest/` 读取，不再调 GitHub API。保留 `/download/:version/:asset` 走版本路径。

### 3. CI R2 上传修复

release job 添加 `CLOUDFLARE_ACCOUNT_ID` 环境变量，让 wrangler 跳过 `/memberships` 调用。

### 4. 安装脚本 URL 不变

安装脚本仍然指向 Worker，Worker 内部从 R2 `releases/latest/` 返回——整个安装流程零 GitHub 依赖。

## Capabilities

### New Capabilities

### Modified Capabilities

## Impact

- **修改**: `.github/workflows/release.yml` — R2 上传路径 + ACCOUNT_ID + 双路径上传
- **修改**: `workers/download/src/index.ts` — `/download/:platform` 改为直接读 R2 latest
- **不改**: 安装脚本（URL 不变）、build.ts、源码
