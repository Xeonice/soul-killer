## Context

`soulkiller --update` 当前通过 GitHub API 获取 latest release 的 tag_name，与本地 `SOULKILLER_VERSION` 比对。相同则跳过。这在同一版本重新发布时无法检测到更新。GitHub Release asset 自带的 `digest` 字段是归档（tar.gz/zip）的 hash，无法与本地解压后的二进制直接比对。

R2 CDN 已有 `releases/latest/version.txt` 供 Worker 使用，但 updater 走的是 GitHub API，未使用 CDN。

## Goals / Non-Goals

**Goals:**
- 同版本重新发布时，`--update` 能检测到二进制内容变更并更新
- 构建时自动生成 checksums.txt，无需手动维护
- 优先使用 CDN 下载 checksums.txt（快），fallback 到 GitHub
- release workflow 支持同 tag 覆盖式发布

**Non-Goals:**
- 不改变 updater 的下载源（仍从 GitHub Release 下载归档）
- 不引入签名验证（GPG/cosign）——scope 过大，后续考虑
- 不改变 version.txt 的内容格式

## Decisions

### Decision 1: checksums.txt 格式

```
# soulkiller v0.3.0 checksums (sha256)
<hash>  soulkiller-darwin-arm64
<hash>  soulkiller-darwin-x64
<hash>  soulkiller-linux-x64
<hash>  soulkiller-linux-arm64
<hash>  soulkiller-windows-x64.exe
```

使用 `sha256sum` 兼容格式（`<hash>  <filename>`），方便用户手动验证。记录的是**解压后二进制**的 hash，不是归档的。

### Decision 2: updater 判断逻辑

```
1. 获取 latest release 版本号
2. 下载 checksums.txt（CDN 优先，fallback GitHub）
3. 计算本地二进制 sha256
4. 查找 checksums.txt 中对应平台的 hash

判断：
  版本不同 → 更新
  版本相同 + hash 不同 → 更新（同版本重发）
  版本相同 + hash 相同 → 跳过
  checksums.txt 不存在 → fallback 到纯版本号比对（兼容旧 release）
```

### Decision 3: checksums.txt 分发

构建时 `build.ts` 生成 `dist/checksums.txt`。release.yml 将其：
1. 上传到 GitHub Release（作为 asset）
2. 上传到 R2 CDN（`releases/latest/checksums.txt` + `releases/<version>/checksums.txt`）

updater 优先从 CDN 下载（`soulkiller-download.../releases/latest/checksums.txt`），失败则从 GitHub Release asset 下载。

### Decision 4: 覆盖式发布

release.yml 在 `gh release create` 前加 `gh release delete "$TAG" --yes 2>/dev/null || true`，确保同 tag 重推不会失败。

## Risks / Trade-offs

- **[风险] CDN checksums.txt 缓存** → Worker 不缓存 latest/ 路径，每次请求都从 R2 读取
- **[风险] 构建中断导致 checksums.txt 和二进制不一致** → checksums.txt 在所有二进制编译完后才生成，原子性由 CI 保证
- **[Trade-off] sha256 计算开销** → 对 ~80MB 文件约 200ms，可接受
