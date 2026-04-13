## 1. 构建流程 — checksums.txt 生成

- [x] 1.1 在 `scripts/build.ts` Phase 2 之后、Phase 3 之前，新增 Phase 2.5：遍历已编译二进制计算 sha256，写入 `dist/checksums.txt`

## 2. CI — 覆盖式发布 + checksums 上传

- [x] 2.1 `release.yml` 在 `gh release create` 前添加 `gh release delete` 实现覆盖式发布
- [x] 2.2 `release.yml` R2 上传步骤中增加 `checksums.txt` 到 `releases/<version>/` 和 `releases/latest/`

## 3. Updater — hash 比对逻辑

- [x] 3.1 新增 `fetchChecksums()` 函数：CDN 优先下载 checksums.txt，fallback GitHub Release asset
- [x] 3.2 新增 `hashFile()` 函数：计算本地二进制 sha256
- [x] 3.3 改写更新判断逻辑：hash 不同则更新，checksums 不可用时 fallback 版本号比对
- [x] 3.4 更新成功后输出新旧 hash 摘要供用户确认
