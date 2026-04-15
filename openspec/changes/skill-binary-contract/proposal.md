## Why

系统目前有一条**未写死的架构契约**，已经隐性遵守但缺一处违反 + 一处真 bug：

**契约**（用户原话提炼）：
- Skill archive 只存**数据**（state、scripts、prompt、角色/世界素材、存档）
- Binary (`soulkiller`) 是**唯一行为**，所有 mutation 必须经 CLI
- Skill → Binary 通信：LLM 按 SKILL.md 指示调 `soulkiller <cmd>`；**不从 skill 内部加载任何代码**

**当前违反**：
- `packager.ts` 的 `injectRuntimeFiles()` 往每个 archive 塞 19 个 `.ts` 源文件到 `runtime/lib/`
- 这些文件**从不被执行**——binary 的 `src/cli/runtime.ts:13` 直接 `import { runCli } from '../export/state/main.js'` 用自己 bundle 的 state CLI
- 每个 archive 多 ~117 KB dead weight；上一个 change（`runtime-manifest-bundling` v0.6.5/v0.6.6）是在**修一段应该删除的代码的 bug**

**致命数据一致性 bug**：
- Phase -1 "Load a Save" 流程（engine.md:144-167）：用户选 `manual:<ts>` → `validate --continue` 只读校验 → LLM `Read manual/<ts>/state.yaml` 进 context → Phase 2 开始
- 但后续 `apply` 调用（`apply.ts:36`）永远读写 **`auto/`**
- **结果**：LLM 基于 manual 快照渲染场景、算选项后果；binary 却把 delta 写到 `auto/` 上一次无关会话的残留状态上 → state 分叉
- 当前没有把 manual 同步到 auto 的命令

**衍生缺口**：删 manual save、废弃 script 草稿也缺独立命令（有 workaround 但不干净）。

本 change 固化契约 + 补齐 CLI 写入面 + 把 `runtime-manifest-bundling` 的遗产清理掉。

## What Changes

### 1. 固化契约（文档）

- `CLAUDE.md` 新增顶级段落 **Skill / Binary Contract (Invariant)**，列出：archive 允许内容、binary 唯一权威、禁止在 skill 内存放可执行代码
- 未来 PR review 指向该段

### 2. 移除 `runtime/lib/*.ts` 打包

- 删 `packager.ts` 的 `injectRuntimeFiles()` 调用 + 函数本体
- 连带删除 `runtime-manifest-bundling` 全部基建：
  - `src/export/state/manifest.ts`（117 KB committed）
  - `scripts/gen-state-manifest.ts`
  - `tests/unit/export/state/gen-manifest.test.ts`
  - `tests/unit/export/state/manifest-parity.test.ts`
  - `tests/unit/export/packager-runtime.test.ts` 中依赖 `injectRuntimeFiles` 的断言
  - `src/index.tsx` 隐藏子命令 `__runtime-manifest-check`
  - `scripts/ci/compiled-export-smoke.ts`
  - CI `verify-state-manifest` + `compiled-binary-smoke` job
  - `package.json` 的 `gen:state-manifest` 前置 hook（dev / test / build / test:integration / test:e2e）
  - `scripts/build.ts` Phase 0
- 换上轻量 CI smoke：跑 `./soulkiller --version` + `./soulkiller runtime --help`，确认 binary 基础可用（不再需要埋 `runtime/lib/` 探针）

### 3. 新增主要缺失命令：`soulkiller runtime load`

- 语义：把 `manual/<ts>/state.yaml` + `meta.yaml` + `history.log` 拷贝覆盖到 `auto/`
- 用途：Phase -1 用户选 manual save 后，先 `load` 再 Read state、进 Phase 2
- 退出码：0 成功 / 1 manual save 不存在或损坏 / 2 参数错
- 实现入口：`src/export/state/load.ts`；`main.ts` 新 dispatch 分支

### 4. 新增次要命令

- `soulkiller runtime save --delete <timestamp>`：删单个 manual save（不走 `--overwrite` 套路）
- `soulkiller runtime script clean <id>`：清除该 script 的 plan / scene / ending 半成品草稿文件（保留已 build 的最终 `script-<id>.json`）

### 5. SKILL.md / engine.md 模板更新

- Phase -1 "Load a Save" 流程加一步 `soulkiller runtime load <id> <save-type>`，顺序改为 validate → load → Read → Phase 2
- 所有对 `runtime/lib/` 的引用（如果还有）清零
- 老 example skill 通过 `upgrade-example-skills.ts` 的 `DEPRECATED_PATHS` 追加 `runtime/lib/` 自动剥离

### 6. 测试覆盖

**Unit tests**：
- `tests/unit/export/state/load.test.ts`：拷贝完整性、manual 不存在、auto 被覆盖、history.log 跟随
- `tests/unit/export/state/save-delete.test.ts`：删除指定 manual / 不存在报错 / 不误伤 auto
- `tests/unit/export/state/script-clean.test.ts`：只清草稿、保留已 build、路径匹配正确
- `tests/unit/export/packager-runtime.test.ts`：改断 "archive 不含 `runtime/lib/*.ts`"（从"必须含"翻到"必须不含"）
- `tests/unit/export/packager-contract.test.ts`（新）：断言 archive 内容符合契约白名单（SKILL.md / soulkiller.json / story-spec.md / souls/ / world/ / runtime/engine.md / runtime/scripts/.gitkeep / runtime/saves/.gitkeep）

**E2E tests**：
- `tests/e2e/22-runtime-load.test.ts`：最小 skill fixture → `init` 建 auto → `save` 快照到 manual/<ts> → `apply` 把 auto 推到新状态 → `load <id> manual:<ts>` → 读 auto 验证等同 manual 原快照
- `tests/e2e/23-script-clean.test.ts`：模拟 plan + 2 scenes 草稿 → `script clean` → 验证草稿清除 / 已 build 的 script 不受影响
- 扩展 `tests/e2e/08-export.test.ts`（或独立 `24-exported-skill-purity.test.ts`）：走完一次 `/export` → 解开产物 → 断言**没有** `runtime/lib/` 目录 / 没有任何 `.ts` 文件在 `runtime/` 下

### 7. Contract CI job（新）

- `.github/workflows/ci.yml` 新增 `verify-skill-archive-purity` job：
  - 建一个 fixture soul + world（或复用 e2e 夹具）
  - 用 dev 模式跑 `packageSkill({...})` 产出 archive
  - 扫 archive：断言**零** `.ts` 文件、**零** `runtime/lib/` 前缀；符合契约白名单
  - 任何违反 → job fail

## Capabilities

### New Capabilities

- `skill-binary-contract`: skill 作为纯数据归档、binary 作为唯一执行权威的架构契约；包含 3 个新 CLI 命令（`load` / `save --delete` / `script clean`）与契约 CI 守护

### Modified Capabilities

- `skill-runtime-state`: 增加 `load` 子命令（manual → auto 恢复）；`save` 扩展 `--delete <timestamp>`；`script build` 之外新增 `script clean`。Phase -1 Load a Save 流程加一步 load。删除 `runtime/lib/` 从归档注入这一动作（归档字节级变化——不含该目录）。
- `example-skills-refresh`: `DEPRECATED_PATHS` 追加 `runtime/lib/`；`upgrade-example-skills.ts --check` 把 `runtime/lib/` 存在视为过期。

## Impact

**删除的代码 / 基建**
- `src/export/state/manifest.ts`（117KB） / `scripts/gen-state-manifest.ts` / `scripts/ci/compiled-export-smoke.ts`
- `tests/unit/export/state/gen-manifest.test.ts` / `tests/unit/export/state/manifest-parity.test.ts`
- `src/index.tsx` 的 `__runtime-manifest-check` 分支
- CI `verify-state-manifest` / `compiled-binary-smoke` jobs
- `package.json` 里 5 个脚本前置的 `gen:state-manifest`
- `scripts/build.ts` Phase 0 的 gen 调用
- `packager.ts` 的 `injectRuntimeFiles()` + 对应 import

**新增代码**
- `src/export/state/load.ts` + `main.ts` 分支
- `src/export/state/save.ts` 扩 `--delete`
- `src/export/state/script-builder.ts` 增 `runScriptClean`
- 新的 e2e + unit test 文件（约 5 个）

**文档**
- `CLAUDE.md` 顶级 Skill / Binary Contract 段落
- `README.md` 或 `docs/` 简单指向该契约（可选）

**模板变动**
- `src/export/spec/skill-template.ts` / `generateEngineTemplate` 的 "Load a Save" 段落新增 load 步

**数据 / 兼容**
- 新产出的 `.skill` 归档比旧版小 ~117 KB（不含 `runtime/lib/`）
- 用户本机老归档里的 `runtime/lib/` 保持原状（binary 从不读）；下次 `skill update` 或 `upgrade-example-skills.ts` 跑过即清
- Phase -1 "Load a Save" 流程行为变化：旧 skill 没有 load 步 → binary 对旧 skill 加一个隐式 auto sync 后备（检测到 manual 载入场景但 auto 不匹配时提示用户 run load，或自动 copy 一次；具体策略在 design.md 决定）
