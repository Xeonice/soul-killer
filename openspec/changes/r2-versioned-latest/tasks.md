## 1. CI R2 上传修复 + 双路径

- [x] 1.1 release.yml：release job 的 wrangler 命令加 `CLOUDFLARE_ACCOUNT_ID` 环境变量（已有）
- [x] 1.2 release.yml：R2 上传改为循环——每个 asset 同时上传到 `releases/<tag>/` 和 `releases/latest/`
- [x] 1.3 release.yml：上传 `releases/latest/version.txt`（内容为 tag 名）
- [x] 1.4 release.yml：wrangler r2 object put 加 `--remote` flag（否则写到本地模拟器）
- [x] 1.5 release.yml：macOS runner 改为 `macos-26`（macos-latest 解析为 macOS 15，产物在 macOS 26 上 SIGKILL）

## 2. Worker 改造

- [x] 2.1 `/download/:platform`：改为直接从 R2 `releases/latest/<asset>` 读取，去掉 GitHub API 调用
- [x] 2.2 `/latest`：从 R2 `releases/latest/version.txt` 读取，fallback GitHub API
- [x] 2.3 `/download/:version/:asset`：从 R2 `releases/<version>/<asset>` 读取，fallback GitHub
- [x] 2.4 部署 Worker

## 3. 手动上传当前版本到新路径 + 验证

- [x] 3.1 手动上传 v0.2.1 的所有 asset 到 `releases/v0.2.1/` 和 `releases/latest/`（用 --remote）
- [x] 3.2 验证：`curl .../download/darwin-arm64` 返回 `x-source: r2` + 正确大小
- [x] 3.3 验证：`curl .../latest` 返回 v0.2.1
- [ ] 3.4 重新安装验证：需要 macOS 26 编译的二进制（等 CI 用 macos-26 runner 重新发布后验证）
