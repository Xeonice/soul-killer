## Why

Soulkiller 目前只能通过 `git clone` + `bun dev` 运行，无法分发给非技术用户。已验证 `bun build --compile` 可在本地交叉编译出 5 个平台的原生二进制（macOS/Linux/Windows × arm64/x64），需要一套完整的构建→发布→安装→更新管线将其交付到最终用户手中。

## What Changes

- 新增 `scripts/build.ts`：构建脚本，bundle（plugin stub devtools）+ 交叉编译 5 个平台二进制
- 新增 `scripts/install.sh`：macOS/Linux 一键安装脚本（检测平台、下载二进制到 `~/.soulkiller/bin/`、注入 PATH）
- 新增 `scripts/install.ps1`：Windows PowerShell 安装脚本
- 新增 `.github/workflows/release.yml`：git tag 触发的 CI，自动构建 + 创建 GitHub Release + 上传产物
- 新增 CLI `--version` / `--update` flag：在 ink 渲染前拦截，支持版本查看和自我更新
- 修改 `src/index.tsx`：增加 flag 解析前置逻辑

## Capabilities

### New Capabilities

- `build-script`: 构建脚本，将 TSX 源码编译为 5 个平台的原生可执行文件
- `install-script`: 安装脚本（sh + ps1），面向非技术用户的一键安装体验
- `release-ci`: GitHub Actions CI，git tag 触发自动构建和发布
- `self-update`: CLI 自我更新功能，查询 GitHub Release 并替换二进制

### Modified Capabilities

（无现有 spec 需要修改）

## Impact

- **新文件**：`scripts/build.ts`、`scripts/install.sh`、`scripts/install.ps1`、`.github/workflows/release.yml`
- **修改文件**：`src/index.tsx`（flag 前置解析）、`package.json`（version 字段用于 --version）
- **CI**：新增 GitHub Actions workflow，tag push 时触发
- **用户数据**：安装目录 `~/.soulkiller/bin/`，PATH 写入 `.zshrc`/`.bashrc`/`.profile`
- **GitHub Release**：每个 tag 产出 5 个二进制 + 2 个安装脚本
