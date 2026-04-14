## Why

当前 `.skill` 归档内置的 Phase -1 要求 LLM 先执行 `soulkiller runtime doctor` 做健康检查。实际 doctor 子命令已退化为空操作——只要进程落地就直接返回 `STATUS: OK`，`BUN_VERSION` 对 binary（已嵌入 bun）也无实际意义。它真正承担的职责只剩一个：`soulkiller` 二进制是否在 PATH。这个信号可以由 Phase -1 的第一条"真正干活"的 `soulkiller runtime <xxx>` 调用自然代替。

与此同时，skill 侧若要做更深的完整性检查（SKILL.md / runtime/lib/main.ts 存在、state.yaml schema 对齐、脏 unzip 导致的嵌套目录）目前无处归档。把这类检查从 skill 内部（Phase -1）移到用户侧的 `soulkiller doctor <path>` 顶层命令更合理：skill 只关心 runtime 能否调通，二进制负责深度体检。

## What Changes

- **BREAKING** 移除 `soulkiller runtime doctor` 子命令（保留 no-op 兼容实现，老 skill 首次加载仍可运行；打印 deprecation 提示）
- **BREAKING** SKILL.md / `runtime/engine.md` 模板删除 Phase -1 Step 0 体检章节；改由"任意首条 `soulkiller runtime <xxx>` 命令命中 command-not-found → 跳安装引导"的约定兼管
- **BREAKING** `lint-skill-template.ts` 移除 `PHASE_0_DOCTOR_PRESENT` 规则，新增 `PHASE_MINUS_ONE_INSTALL_GUIDE_PRESENT` 确保 SKILL.md 仍在 Phase -1 里给出安装引导分支
- 新增顶层 `soulkiller doctor [path]` 命令：
  - 无参时只检查 binary 自检（PATH + 嵌入 bun 版本）
  - 带 path 时校验 skill 归档结构：SKILL.md 存在 / runtime/lib/main.ts 存在 / runtime/scripts/ 可选 / 所有 runtime/lib/*.ts 文件完整性；输出结构化 `KEY: value`
- `src/cli/runtime.ts` 里 runtime 子命令 dispatcher 看到 `doctor` 仍走兼容路径（no-op + deprecation），看到其他子命令正常处理

### 升级策略（已分发 skill + 示例库）

- 复用现有 `soulkiller skill upgrade` 命令：bump 内嵌的 `engine_version`，覆盖 `runtime/engine.md` 内容（删除 Step 0 Runtime Health Check），同步 `soulkiller.json` 的 `engine_version` / `soulkiller_version`
- 本次不涉及首次迁移场景（无 `soulkiller.json` 的旧 skill）的逻辑变更，走既有首次迁移路径即可受益
- **示例库**（`examples/skills/*.skill`）在本次 change 合入后由维护者重新生成并提交到仓库，CI 上传到 R2 的 `soulkiller-releases/examples/skills/` 覆盖旧版
- 用户侧升级路径：
  - 已用 `soulkiller skill upgrade` 安装的 skill：再跑一次 `soulkiller skill upgrade [--all]` 即可
  - 手动从 R2 下载的 skill：按 README 同样一键脚本重新下载并 unzip（脚本已带 `rm -rf` 覆盖）
  - 老 skill 未升级时仍可运行（`runtime doctor` 兼容层保住首次加载）

## Capabilities

### New Capabilities
- `soulkiller-doctor`: 顶层 `soulkiller doctor [path]` 命令，承载 binary 自检 + skill 归档深度校验（SKILL.md 存在、runtime/lib 文件完整性、state.yaml schema 对齐等）

### Modified Capabilities
- `skill-runtime-binary`: 移除 Phase -1 Step 0 健康检查要求；保留 `runtime doctor` no-op 兼容（用于老 skill 档案首次加载不炸）
- `skill-upgrade`: bump `engine_version` 基线，`runtime/engine.md` 模板内容同步移除 Phase -1 Step 0 章节

## Impact

- `src/export/state/main.ts` — `doctor` 分支改为 no-op + deprecation stderr
- `src/cli/runtime.ts` — 不变（仍会把 `doctor` 转发给 runtime dispatcher）
- `src/export/spec/skill-template.ts` — 删除 `buildPhaseMinusOne` 里的 Step 0 Runtime Health Check 章节，Step -1.1 直接作为首个 Step；在 AskUserQuestion 分支里改由"runtime 命令执行报 command-not-found 时触发"
- `src/export/support/lint-skill-template.ts` — 删除 `PHASE_0_DOCTOR_PRESENT`；加 `PHASE_MINUS_ONE_INSTALL_GUIDE_PRESENT`
- `src/cli/commands/` — 新增 `soulkiller doctor` 顶层命令（非 slash 命令，binary 层级）
- `src/cli/app.tsx` / CLI entry — 注册 `--doctor` 或 `doctor` 位置参数
- `tests/unit/export/state/*.test.ts` — 调整 doctor 相关用例（保留 no-op 行为测试）
- `tests/unit/export/support/lint-skill-template.test.ts` — 新规则用例
- 新增 `tests/unit/cli/doctor.test.ts` — 顶层 doctor 的 binary/skill-archive 检查用例
- 已分发的老 `.skill` 归档：首次加载仍会跑 `soulkiller runtime doctor`，兼容层确保不中断流程
- `examples/skills/*.skill`（仓库内 + R2 托管的示例库）：由维护者在本次 change 合入后用最新 binary 重新 `/export` 生成，commit 覆盖旧文件；下一次 tag push 的 CI 会把新文件推到 R2
