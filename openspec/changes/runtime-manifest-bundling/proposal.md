## Why

`packager.ts:481` 的 `injectRuntimeFiles()` 用 `fs.readdirSync(path.join(dirname(import.meta.url), 'state'))` 在**运行时**读取 `src/export/state/*.ts`。Bun 的 bundler 没办法静态看到这个调用，所以这 19 个文件**根本没进 compiled binary**。结果：

- Dev 模式（`bun src/index.tsx`）：真实磁盘有 `src/export/state/`，fs 调用成功 → 一切正常
- Release 模式（`soulkiller` 二进制）：虚拟 FS 里没有 `/$bunfs/root/state` → **ENOENT 崩溃，导出失败**

报错现场：用户花 21k tokens 完整跑完 agent planning + character loop + axes setup 之后，`finalize_export` 阶段炸在 packager step，一份归档没落地。

这不是第一次了——`skill-runtime-binary` change 引入了这个函数，主观意图明明是"让二进制成为跨平台 runtime 入口"，结果二进制自身的导出功能因为 bundler 盲区直接挂掉。深层教训：**任何需要被 packager 注入归档的运行时资源，必须是静态可见的 import，不能是 `fs.readdir`**。

我们的测试矩阵全跑 dev 模式（单元、component、e2e、`spawnCli` 底下也是 `bun src/index.tsx`），所以这种"打包才炸"的 bug 完全漏网。

## What Changes

**数据层：显式 runtime 文件清单**
- 新增 `src/export/state/manifest.ts`——**静态 import** 每个 `state/*.ts` 文件，用 Bun 的 `with { type: 'text' }` 直接把源码当字符串内嵌。Bundler 看得见这些 import，文件内容进 `bundle.js` → 进二进制。
- 手维护是 anti-pattern；由 `scripts/gen-state-manifest.ts` 自动生成，扫 `state/` 下所有 `.ts`（排除 `manifest.ts` 自己），输出带确定性排序的 manifest 文件。
- `package.json` 的 `dev` / `test` / `build` 脚本加 `gen-state-manifest` 前置步骤，保证 manifest 永远跟 `state/` 一致。
- `packager.ts` 的 `injectRuntimeFiles` 改为从 `manifest.ts` 导入的 `RUNTIME_FILES` 读取；**完全移除运行时 `fs.readdirSync`**。

**测试层：三重防护**
- **单元测试 `tests/unit/export/state/manifest-parity.test.ts`**：运行时重新扫 `state/*.ts`，跟 committed `manifest.ts` 对比。任何缺失 / 过期 → fail，并打印应该运行的脚本命令。
- **CI job `verify-state-manifest`**（`.github/workflows/ci.yml`）：跑 `bun scripts/gen-state-manifest.ts && git diff --exit-code src/export/state/manifest.ts` → PR 改了 state/ 但没同步 manifest 即阻断。
- **CI job `compiled-binary-smoke`**：用 `bun build --compile` 产出二进制，再跑 `./soulkiller-linux-x64 --version` + 一个 embedded 导出 smoke（触发 `injectRuntimeFiles`），验证虚拟 FS 里资源齐全。这层堵住**整类** "runtime assets missing in binary" bug。

**文档**
- `CLAUDE.md` 的 "Export / Skill format" 段落补一句：**任何 packager 需要注入的资源必须走 static import（通常通过 manifest），禁止 fs.readdir 模式**。
- 新增 `docs/`（如果不存在则 inline 在 CLAUDE.md）一段"why runtime manifest"，防止下次有人忘了原因把 import 改回 fs 扫描。

## Capabilities

### New Capabilities
- `runtime-manifest-bundling`: state CLI 源文件从 `src/export/state/*.ts` 自动生成静态 manifest 并被 bundler 内嵌到 compiled binary；配套 parity 测试 + CI 守护；compiled binary 也被 CI smoke test 覆盖。

### Modified Capabilities
_无现存能力被修改_——packager 的 `injectRuntimeFiles` 契约不变（同样注入 `runtime/lib/<file>.ts`），只是内部实现从 fs 扫描换成 manifest 查表。

## Impact

**受影响代码**
- `src/export/packager.ts:481-501` — 重写 `injectRuntimeFiles` 为 manifest 驱动
- `src/export/state/manifest.ts` — 新文件（自动生成、committed）
- `scripts/gen-state-manifest.ts` — 新脚本
- `package.json` — `dev` / `test` / `build` / `test:integration` / `test:e2e` 脚本加 prebuild hook
- `scripts/build.ts` — Phase 0 插入 gen-state-manifest 步（release build 时自愈）
- `.github/workflows/ci.yml` — 两个新 job：`verify-state-manifest` + `compiled-binary-smoke`

**受影响测试**
- 新增 `tests/unit/export/state/manifest-parity.test.ts`
- `tests/unit/export/packager-runtime.test.ts` 可能要调整（原本依赖 fs.readdirSync 的断言方式要改成 manifest 比对）
- 无 e2e 改动（e2e 在 dev 模式工作正常；compiled smoke 单独在 CI）

**受影响文档**
- `CLAUDE.md` 补一条 authoring guideline

**依赖 / 兼容**
- 无新 npm 依赖——全用 Bun 原生 `with { type: 'text' }` import + fflate 已有
- 不破坏现有 skill archive 格式：`runtime/lib/*.ts` 内容字节完全一致
- 对现有 test 套件兼容：gen-state-manifest 是幂等的，dev 跑任意 `bun` 命令前会自动刷新 manifest

**数据 / 回滚**
- 这次导出失败的 skill archive 没有部分写入（finalize_export 整体抛错），磁盘无需清理
- 回滚策略：manifest.ts 可 revert；回退到 fs.readdirSync 后 dev 可用，但 release 会继续炸——换句话说**新状态比旧状态更安全**，回滚只是退回到已知故障态
