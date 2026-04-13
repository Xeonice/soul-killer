## Why

CI 在 `ubuntu-latest` 上用 `bun build --compile --target=bun-darwin-arm64` 交叉编译 macOS 二进制。产出的 Mach-O 文件在真实 macOS 上被 SIGKILL(9)——内核直接杀掉进程，无法运行。

实测对比：
- 本地原生编译：66.5MB，正常运行
- CI 交叉编译：64.7MB，SIGKILL

这导致所有 macOS 用户通过 install.sh 安装后无法使用 soulkiller。

## What Changes

release.yml 从单 runner 改为多平台矩阵：
- `macos-latest` 原生编译 darwin-arm64 + darwin-x64
- `ubuntu-latest` 编译 linux-x64 + linux-arm64 + 交叉编译 windows-x64（Windows 交叉编译无此问题）
- 最后一个 job 汇总所有平台产物，创建 GitHub Release + 上传 R2

## Capabilities

### New Capabilities

### Modified Capabilities
- `release-ci`: 从单 runner 交叉编译改为多平台原生编译矩阵

## Impact

- **修改**: `.github/workflows/release.yml` — 拆分为 build matrix + release job
- **不改**: `scripts/build.ts`、安装脚本、Worker、源码
