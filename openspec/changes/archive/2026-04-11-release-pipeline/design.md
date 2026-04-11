## Context

已验证的技术事实：
- `bun build` + plugin（stub `react-devtools-core`）产出 4.6MB JS bundle
- `bun build --compile --target=bun-{platform}` 可在 macOS 本地交叉编译全部 5 个目标
- 产出二进制大小：darwin-arm64 63MB / darwin-x64 67MB / linux-x64 99MB / linux-arm64 99MB / windows-x64 114MB
- ink TUI 在编译后的二进制中正常运行（TTY 环境下）
- 运行时配置在 `~/.soulkiller/config.yaml`

## Goals / Non-Goals

**Goals:**
- 非技术用户一条命令安装并运行 soulkiller
- git tag push 自动触发构建 + 发布全部平台二进制
- 用户可通过 `soulkiller --update` 自我更新到最新版本

**Non-Goals:**
- 不做 Homebrew formula / apt 仓库 / winget manifest（后续考虑）
- 不做自动更新提示（用户主动 `--update`）
- 不做签名/公证（macOS notarize / Windows code signing 后续考虑）
- 不做 delta 增量更新（全量替换即可）

## Decisions

### 1. 构建脚本 `scripts/build.ts`

```ts
// 两阶段构建
// Phase 1: bundle (一次)
bun build src/index.tsx → dist/bundle.js
  plugin: stub react-devtools-core

// Phase 2: compile (每平台一次)
for target of [darwin-arm64, darwin-x64, linux-x64, linux-arm64, windows-x64]:
  bun build dist/bundle.js --compile --target=bun-{target}
    --outfile dist/soulkiller-{target}[.exe]
```

产出命名约定：`soulkiller-{os}-{arch}[.exe]`，压缩为 `.tar.gz`（Unix）和 `.zip`（Windows）。

### 2. CI 流程 `.github/workflows/release.yml`

```
触发: push tag v*

jobs:
  build:
    runs-on: ubuntu-latest (bun 支持本地交叉编译，不需要矩阵)
    steps:
      - checkout
      - setup bun
      - bun install
      - bun scripts/build.ts
      - 压缩各平台产物
      - 复制 install.sh / install.ps1 到 dist/
      - gh release create $TAG --title $TAG dist/*
```

关键点：**单 runner 构建全部 5 个平台**。bun 的交叉编译能力让我们不需要 macOS/Windows runner。

### 3. 安装脚本 `scripts/install.sh`

```
流程:
  1. 检测 OS (uname -s → darwin/linux)
  2. 检测 Arch (uname -m → arm64/x86_64 → arm64/x64)
  3. 组装下载 URL:
     https://github.com/Xeonice/soul-killer/releases/latest/download/soulkiller-{os}-{arch}.tar.gz
  4. 下载 + 解压到 ~/.soulkiller/bin/soulkiller
  5. 检查 PATH 是否包含 ~/.soulkiller/bin
  6. 若不包含，追加 export 到 shell rc 文件:
     - zsh → ~/.zshrc
     - bash → ~/.bashrc
     - fish → ~/.config/fish/config.fish
     - 通用 fallback → ~/.profile
  7. 打印成功信息 + 提示打开新终端或 source rc
```

### 4. Windows 安装脚本 `scripts/install.ps1`

```
流程:
  1. 下载 soulkiller-windows-x64.zip
  2. 解压到 $env:LOCALAPPDATA\soulkiller\
  3. 将该目录加入用户 PATH (通过 [Environment]::SetEnvironmentVariable)
  4. 打印成功信息
```

### 5. 自我更新 `--update`

在 `src/index.tsx` 入口处，ink 渲染前拦截 argv：

```
process.argv 包含 --version → 打印版本号 → exit
process.argv 包含 --update  → 执行更新逻辑 → exit
否则 → 正常启动 ink App
```

更新逻辑（新文件 `src/cli/updater.ts`）：
1. 调用 GitHub API: `GET /repos/Xeonice/soul-killer/releases/latest`
2. 解析 `tag_name` 与当前 `package.json` version 对比
3. 若有新版本，检测当前平台，下载对应二进制
4. 写入临时文件，rename 替换 `process.execPath`（原子操作）
5. 打印更新结果

### 6. 版本注入

构建时通过 `--define` 注入版本号：
```ts
bun build src/index.tsx --define "process.env.SOULKILLER_VERSION='0.1.0'"
```
从 `package.json` 读取 version 字段，注入到 bundle 中。运行时 `process.env.SOULKILLER_VERSION` 直接可用。

## Risks / Trade-offs

| 风险 | 缓解 |
|------|------|
| macOS Gatekeeper 拦截未签名二进制 | install.sh 中加 `xattr -d com.apple.quarantine` 清除隔离属性 |
| Linux 99MB 二进制偏大 | 压缩后 ~33MB 可接受；后续可考虑 UPX 压缩 |
| GitHub API rate limit 影响 --update | 匿名 60 req/hour 足够；失败时给明确错误信息 |
| self-update 替换自身二进制时可能失败 | 写入临时文件后 rename，失败不影响当前二进制 |
| ubuntu runner 上 bun 交叉编译是否稳定 | 已在本地验证全部 5 个 target；CI 中相同 bun 版本 |
| Windows PowerShell 执行策略阻止 install.ps1 | 脚本头部加 `Set-ExecutionPolicy Bypass -Scope Process` 提示 |
