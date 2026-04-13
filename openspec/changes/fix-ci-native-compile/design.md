## Context

当前 release.yml 是单 job（ubuntu-latest），用 bun 交叉编译 5 平台。macOS 产物坏了。

## Goals / Non-Goals

**Goals:**
- macOS 二进制在真实 macOS 上能正常运行
- 保持 R2 上传和 GitHub Release 创建

**Non-Goals:**
- 不改 build.ts（它已支持只编译指定平台）
- 不做代码签名/公证（后续可加，当前用 ad-hoc 或无签名）

## Decisions

### 1. CI 矩阵拆分

```yaml
jobs:
  build:
    strategy:
      matrix:
        include:
          - os: macos-latest
            targets: darwin-arm64,darwin-x64
          - os: ubuntu-latest
            targets: linux-x64,linux-arm64,windows-x64
    runs-on: ${{ matrix.os }}
    steps:
      - checkout + setup bun + install deps
      - 只编译 matrix.targets 指定的平台
      - upload-artifact 上传 dist/

  release:
    needs: build
    runs-on: ubuntu-latest
    steps:
      - download-artifact 汇总所有平台的 dist/
      - copy install scripts
      - gh release create
      - wrangler r2 upload
```

### 2. build.ts 需要支持过滤目标

当前 build.ts 硬编码编译全部 5 平台。需要支持 `TARGETS` 环境变量或参数来只编译指定平台：

```bash
# 只编译 macOS 目标
SOULKILLER_TARGETS=darwin-arm64,darwin-x64 bun scripts/build.ts

# 编译全部（默认，本地开发用）
bun scripts/build.ts
```

### 3. macOS runner 上跑测试

测试在两个 runner 上都跑（矩阵自带），这样 macOS 测试也覆盖到了。
