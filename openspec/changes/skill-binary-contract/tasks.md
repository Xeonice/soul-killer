## 1. 契约文档

- [x] 1.1 `CLAUDE.md` 在 "## What is Soulkiller" 之后插入 "## Skill / Binary Contract (Invariant)" 段落
- [x] 1.2 删除旧的 "Runtime asset bundling" 段落（已被新契约段落覆盖）

## 2. 新命令实现

- [x] 2.1 新增 `src/export/state/load.ts` — `runLoad(skillRoot, scriptId, saveType)`：manual → auto；含 `LoadError` 类
- [x] 2.2 `src/export/state/save.ts` 新增 `runSaveDelete`；main.ts 处理 `--delete` 与 `--overwrite` 互斥
- [x] 2.3 `src/export/state/script-builder.ts` 新增 `runScriptClean`：扫 `.build-<id>/`、保留 `script-<id>.json`
- [x] 2.4 `src/export/state/main.ts` 分派：`load` 子命令 / `save --delete` 分支 / `script clean` 子分支
- [x] 2.5 `SUBCOMMANDS` + `printHelp` 同步新增
- [x] 2.6 **(D8.3)** `src/cli/runtime.ts` — `--help` / `-h` / 无参短路 SKILL_ROOT 检查
- [x] 2.7 **(D8.4)** `src/index.tsx` — 隐藏 `__pack-fixture` 子命令；调用 packageSkill 用真实 soul/world 数据；用于 binary 端打包烟雾

## 3. 单元测试

- [x] 3.1 `tests/unit/export/state/load.test.ts`：5 场景（拷贝完整性 / 不存在 / auto 拒 / 无 auto / 幂等）
- [x] 3.2 `tests/unit/export/state/save-delete.test.ts`：3 场景
- [x] 3.3 `tests/unit/export/state/script-clean.test.ts`：4 场景
- [x] 3.4 `tests/unit/export/state/integration-load-apply.test.ts`：**关键回归**——构造 timeline 分叉场景验证 load 后 apply 基于 manual 起点

## 4. 契约守护：白名单单测

- [x] 4.1 `tests/unit/export/packager-contract.test.ts`：6 场景验证 `checkArchiveContract` 白名单
- [x] 4.2 `tests/unit/export/packager-runtime.test.ts` 重写——只保留 `countMdFilesInMap` 相关测试；移除 `injectRuntimeFiles` 相关
- [x] 4.3 `tests/unit/soul/package-tools.test.ts` — 改 `runtime/lib/*.ts` 应该在归档中的断言为"应该不在"

## 5. 模板更新

- [x] 5.1 `src/export/spec/skill-template.ts` 的 "Load a Save" 小节加 step "若 manual → 调 `soulkiller runtime load`"；后续 step 改为永远 Read auto
- [x] 5.2 模板 lint 加 `NO_INTERNAL_RUNTIME_EXEC`：检测 `bash $CLAUDE_SKILL_DIR/runtime/...` / `bun $CLAUDE_SKILL_DIR/runtime/...` 等违反契约的命令引用

## 6. 删除 runtime-manifest-bundling 基建

- [x] 6.1 `src/export/packager.ts`：删 `injectRuntimeFiles()` + 调用 + import
- [x] 6.2 删 `src/export/state/manifest.ts`（117KB）
- [x] 6.3 删 `scripts/gen-state-manifest.ts`
- [x] 6.4 删 `scripts/ci/compiled-export-smoke.ts`
- [x] 6.5 删 `tests/unit/export/state/gen-manifest.test.ts`
- [x] 6.6 删 `tests/unit/export/state/manifest-parity.test.ts`
- [x] 6.7 `src/index.tsx`：删 `__runtime-manifest-check` 分支
- [x] 6.8 `package.json`：移除 5 处前置 hook + `gen:state-manifest` 独立脚本
- [x] 6.9 `scripts/build.ts`：删 Phase 0 gen 调用

## 7. CI 改造

- [x] 7.1 `.github/workflows/ci.yml`：删 `verify-state-manifest` job
- [x] 7.2 `compiled-binary-smoke` 改造：build → extract → `--version` + `runtime --help`，去掉 manifest-check 依赖
- [x] 7.3 新增 `verify-skill-archive-purity` job + `scripts/ci/verify-skill-archive-purity.ts`：扫 `examples/skills/*.skill` 验白名单

## 8. 老归档清理

- [x] 8.1 **(D8.2)** `scripts/upgrade-example-skills.ts` 的 `DEPRECATED_PATHS` 追加 `runtime/lib/` + `.DS_Store`；`isDeprecated` 加第三种 basename 匹配（不含 `/` 的项按 basename 匹配任意深度）
- [x] 8.2 `inspectOne` 自动识别 `runtime/lib/` 与 `.DS_Store` 为过期
- [x] 8.3 跑 `bun scripts/upgrade-example-skills.ts`：3 个 example 清除 `runtime/lib/` + `.DS_Store`
- [x] 8.4 **(D8.1)** `bun scripts/build-catalog.ts` 刷新 catalog；`packager.ts` 的 `ALLOWED_PREFIXES` 加 `runtime/tree/`（viewer 服务的 PID 文件目录）

## 9. E2E

- [x] 9.1 `tests/e2e/22-runtime-load.test.ts`：3 场景（load 成功 / load auto 拒 / 不存在 manual）
- [ ] 9.2 `tests/e2e/23-script-clean.test.ts`（跳过——unit 4 场景已充分覆盖；CLI dispatch 由 22 路径同质验证）
- [x] 9.3 `tests/e2e/24-exported-skill-purity.test.ts`：扫 examples/skills/* 验白名单（local mirror of CI job）
- [ ] 9.4 现有 e2e 同步检查（17/18）—— 未发现依赖 `runtime/lib` 的断言；无需改动
- [ ] 9.5 `tests/e2e/harness/mock-catalog-server.ts` 产出的测试 archive — 已是简单 fixture，不含 runtime/lib

## 10. 发布验证

- [x] 10.1 `bun run build`（tsc --noEmit）通过
- [x] 10.2 `bun run test` **109 files / 1133 tests green**
- [x] 10.3 skill + load + purity e2e 33 tests green（8 files）
- [x] 10.4 **(D8.4 验证)** 本地 darwin-arm64 build → `__pack-fixture smoke V "Fate Stay Night" /tmp/out` → 验白名单：✓ 58 文件全合规，无 `runtime/lib/` / `.ts` / `.sh`
- [ ] 10.5 手工 load 场景（unit integration-load-apply 已严格验证；手工次要，可选）
- [ ] 10.6 CI 全绿（unit / integration / e2e / verify-examples / verify-skill-archive-purity / compiled-binary-smoke 轻量版）—— push 后观察
- [ ] 10.7 `openspec archive skill-binary-contract`（留给用户触发）
