## 1. 构建脚本

- [x] 1.1 创建 `scripts/build.ts`：Phase 1 bundle（devtools stub plugin + version define）→ Phase 2 交叉编译 5 个平台
- [x] 1.2 添加压缩逻辑：Unix 平台 `.tar.gz`，Windows `.zip`
- [x] 1.3 本地验证：执行 `bun scripts/build.ts`，确认 `dist/` 下产出 5 个二进制 + 5 个压缩包
- [x] 1.4 在 `package.json` 中添加 `"build:release": "bun scripts/build.ts"` script

## 2. CLI flag 前置处理

- [x] 2.1 修改 `src/index.tsx`：在 ink render 前拦截 `--version` 和 `--update` argv
- [x] 2.2 `--version`：读取 `process.env.SOULKILLER_VERSION`（构建注入）或 fallback 到 `dev`，打印并退出
- [x] 2.3 创建 `src/cli/updater.ts`：查询 GitHub API latest release、比对版本、下载对应平台二进制、原子替换 `process.execPath`
- [x] 2.4 `--update`：调用 updater，打印更新进度和结果

## 3. 安装脚本

- [x] 3.1 创建 `scripts/install.sh`：检测 OS/Arch、下载 GitHub Release 二进制、解压到 `~/.soulkiller/bin/`、配置 PATH、macOS quarantine 清除
- [x] 3.2 创建 `scripts/install.ps1`：下载 Windows 二进制、解压到 `$env:LOCALAPPDATA\soulkiller\`、配置用户 PATH
- [x] 3.3 在各 shell 环境下验证 install.sh（zsh/bash 至少）

## 4. GitHub Actions CI

- [x] 4.1 创建 `.github/workflows/release.yml`：tag `v*` 触发、setup bun、install、test、build、compress、gh release create
- [x] 4.2 验证 workflow 语法正确（YAML 语法检查通过）

## 5. 验证与文档

- [x] 5.1 端到端验证：本地构建 → 解压 → 运行二进制 → `--version` → `--update`（mock 或真实）
- [x] 5.2 更新 CLAUDE.md 添加发布流程说明
- [x] 5.3 更新 package.json version 为 0.2.0（首次发布版本）
