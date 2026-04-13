## 1. build.ts 支持目标过滤

- [x] 1.1 修改 `scripts/build.ts`：读取 `SOULKILLER_TARGETS` 环境变量（逗号分隔的平台列表），为空时编译全部 5 平台（保持现有行为）
- [x] 1.2 验证：`SOULKILLER_TARGETS=darwin-arm64 bun scripts/build.ts` 只产出 darwin-arm64

## 2. release.yml 多平台矩阵

- [x] 2.1 将现有单 job 拆为 `build`（矩阵）+ `release`（汇总）两个 job
- [x] 2.2 build job：macos-latest 编译 darwin-arm64,darwin-x64；ubuntu-latest 编译 linux-x64,linux-arm64,windows-x64
- [x] 2.3 build job：每个 runner 跑测试 + 编译 + upload-artifact
- [x] 2.4 release job：download-artifact 汇总 → copy install scripts → gh release create → wrangler r2 upload

## 3. R2 缓存清理

- [x] 3.1 新版本发布后，R2 上传步骤会用新版本路径（v0.2.1/），旧版本 (v0.2.0/) 自然不再被 Worker 引用

## 4. 验证

- [x] 4.1 本地验证 build.ts 目标过滤正常
- [ ] 4.2 推送 + 打 tag 触发 CI，确认两个 runner 都成功
- [ ] 4.3 安装验证：`curl -fsSL .../install.sh | sh` → `soulkiller --version` 正常输出
