## Context

Worker + R2 基础设施已部署，但 CI 上传失败 + Worker 依赖 GitHub API。

## Goals / Non-Goals

**Goals:**
- CI R2 上传能正常工作
- 安装流程零 GitHub API 依赖
- 版本归档可回滚

**Non-Goals:**
- 不改安装脚本 URL
- 不改 Worker 域名

## Decisions

### 1. R2 路径规范

```
soulkiller-releases/
  releases/
    latest/                          ← CI 每次覆盖
      soulkiller-darwin-arm64.tar.gz
      soulkiller-darwin-x64.tar.gz
      soulkiller-linux-x64.tar.gz
      soulkiller-linux-arm64.tar.gz
      soulkiller-windows-x64.zip
      version.txt                    ← 内容就是 "v0.2.1"
    v0.2.1/                          ← 版本归档
      soulkiller-darwin-arm64.tar.gz
      ...
  scripts/
    install.sh
    install.ps1
```

`version.txt` 是一个纯文本文件，Worker 可以用它代替 GitHub API。

### 2. CI release job 修复

```yaml
- name: Upload to Cloudflare R2
  env:
    CLOUDFLARE_API_TOKEN: ${{ secrets.CLOUDFLARE_API_TOKEN }}
    CLOUDFLARE_ACCOUNT_ID: ${{ secrets.CLOUDFLARE_ACCOUNT_ID }}
  run: |
    VERSION="${{ github.ref_name }}"
    for asset in dist/soulkiller-*.tar.gz dist/soulkiller-*.zip; do
      name=$(basename "$asset")
      npx wrangler r2 object put "soulkiller-releases/releases/$VERSION/$name" --file "$asset"
      npx wrangler r2 object put "soulkiller-releases/releases/latest/$name" --file "$asset"
    done
    echo "$VERSION" > /tmp/version.txt
    npx wrangler r2 object put "soulkiller-releases/releases/latest/version.txt" --file /tmp/version.txt
    npx wrangler r2 object put "soulkiller-releases/scripts/install.sh" --file dist/install.sh
    npx wrangler r2 object put "soulkiller-releases/scripts/install.ps1" --file dist/install.ps1
```

### 3. Worker 改造

`/download/:platform`:
1. 从 R2 读 `releases/latest/<asset>`，直接返回
2. 不再调 GitHub API

`/latest`:
1. 从 R2 读 `releases/latest/version.txt`
2. fallback 到 GitHub API

`/download/:version/:asset`:
1. 从 R2 读 `releases/<version>/<asset>`
2. fallback 到 GitHub → 缓存到 R2
