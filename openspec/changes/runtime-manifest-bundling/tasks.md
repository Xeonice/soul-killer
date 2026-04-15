## 1. 生成器 + manifest

- [x] 1.1 新增 `scripts/gen-state-manifest.ts`：扫 `src/export/state/*.ts`，排除 manifest/test/spec/隐藏；幂等写入
- [x] 1.2 manifest 格式改为 inline 字符串字面量（`JSON.stringify(fileContent)`）—— bun 不支持 `.ts` 的 `with { type: 'text' }`；inline 更健壮、跨 dev/vitest/compiled 一致
- [x] 1.3 首次运行产出 `src/export/state/manifest.ts`（117 KB，committed）
- [x] 1.4 单测 `tests/unit/export/state/gen-manifest.test.ts`：shouldInclude / toCamelCase / buildManifest 排序稳定 / inline 引用 / header

## 2. Packager 切换

- [x] 2.1 `packager.ts`：删除 `fs.readdirSync` + `fileURLToPath`；import `RUNTIME_FILES` 直接查表
- [x] 2.2 空 manifest 断言 + 可诊断错误消息
- [x] 2.3 `tests/unit/export/packager-runtime.test.ts` 调整：过滤 `manifest.ts`；字节比对用 `TextDecoder`

## 3. Parity 测试

- [x] 3.1 `tests/unit/export/state/manifest-parity.test.ts`：内存生成 vs committed 文件 diff；3 个场景
- [x] 3.2 覆盖：一致 / state 多文件缺登记 / manifest 多文件已删除

## 4. 脚本集成

- [x] 4.1 `package.json` 的 `dev` / `build` / `test` / `test:integration` / `test:e2e` 前置 `gen-state-manifest`；新增 `gen:state-manifest` 独立脚本入口
- [x] 4.2 `scripts/build.ts` Phase 0 加一次 `gen-state-manifest`（release safety net）

## 5. CI

- [x] 5.1 `.github/workflows/ci.yml` 加 `verify-state-manifest` job：跑脚本 + `git diff --exit-code`
- [x] 5.2 `.github/workflows/ci.yml` 加 `compiled-binary-smoke` job：build linux-x64 → 解压 → `--version` → smoke script
- [x] 5.3 `scripts/ci/compiled-export-smoke.ts`：spawn binary 跑 `__runtime-manifest-check`；断言 19 文件、mini-yaml.ts 非空
- [x] 5.4 `src/index.tsx` 加隐藏子命令 `__runtime-manifest-check`：导出 RUNTIME_FILES 的 keys + miniYamlLen 为 JSON；空时 exit 1

## 6. 文档

- [x] 6.1 `CLAUDE.md` "Export / Skill format" 加 Runtime asset bundling guideline
- [x] 6.2 生成器脚本顶部注释说明背景

## 7. 发布验证

- [x] 7.1 `bun run build`（gen + tsc --noEmit）通过
- [x] 7.2 `bun run test` 全绿（106 files / 1134 tests，含 parity + gen-manifest）
- [x] 7.3 手工：`SOULKILLER_TARGETS=darwin-arm64 bun scripts/build.ts` 本地产 binary + 解压 → 跑 smoke：`✓ compiled binary embeds 19 state files; mini-yaml.ts=6196 bytes`
- [ ] 7.4 发 release 前 CI 所有 job 绿（含新 `verify-state-manifest` + `compiled-binary-smoke`）
- [ ] 7.5 `openspec archive runtime-manifest-bundling`（留给用户触发）
