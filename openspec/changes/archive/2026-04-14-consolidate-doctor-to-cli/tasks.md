## 1. 新增 `soulkiller doctor` 顶层命令

- [x] 1.1 新建 `src/cli/doctor.ts`：导出 `runDoctor(args: string[]): Promise<number>`，按决策 4 输出 `KEY: value` 协议
- [x] 1.2 实现 binary 自检部分：`SOULKILLER_VERSION` / `BUN_VERSION` / `PLATFORM`
- [x] 1.3 实现 skill archive 检查部分：`SKILL.md` 存在 / `runtime/lib/main.ts` 存在 / `runtime/lib/*.ts` 基线列表完整性 / 可选的 `runtime/scripts/` 计数
- [x] 1.4 非 skill 目录（缺 SKILL.md）时输出 `STATUS: FAIL` + exit 1，不做启发式猜测
- [x] 1.5 在 `src/index.tsx` CLI 解析阶段识别 `doctor` 子命令，在 ink 渲染前 dispatch，避免加载 REPL 依赖

## 2. `runtime doctor` 保留 no-op + deprecation

- [x] 2.1 `src/export/state/main.ts`：`doctor` 分支 stdout 保持原有 4 字段输出（兼容老 skill）
- [x] 2.2 增加一行 stderr deprecation notice：`DEPRECATED: use 'soulkiller doctor' instead`
- [x] 2.3 调整相关单元测试：断言 stdout 协议不变 + stderr 含 deprecation

## 3. SKILL.md 模板移除 Step 0

- [x] 3.1 `src/export/spec/skill-template.ts`：删除 `buildPhaseMinusOne` 中 "Step 0: Runtime Health Check" 章节
- [x] 3.2 Step -1.1 提升为 Phase -1 的首个可执行步骤，并在其开头补充："若首条 `soulkiller runtime scripts` 返回 command-not-found，进入下文的安装引导分支"
- [x] 3.3 将"Command not found / 安装引导 AskUserQuestion + 两个选项"保留为独立分支章节，措辞改为"any `soulkiller runtime <subcommand>` returns command-not-found"
- [x] 3.4 read-only 模式描述保留，确保 lint 规则仍能命中

## 4. lint 规则迁移

- [x] 4.1 `src/export/support/lint-skill-template.ts`：删除 `PHASE_0_DOCTOR_PRESENT` 规则块
- [x] 4.2 新增 `PHASE_MINUS_ONE_INSTALL_GUIDE_PRESENT` 规则：要求 SKILL.md 同时包含 `command not found` / `AskUserQuestion` / `install.sh` / `install.ps1` 四个字面量
- [x] 4.3 测试 `tests/unit/export/support/lint-skill-template.test.ts` 新规则用例

## 5. 文档与 i18n

- [x] 5.1 `CLAUDE.md` 更新 `lint/` 章节规则列表：去掉 `PHASE_0_DOCTOR_PRESENT`，加上 `PHASE_MINUS_ONE_INSTALL_GUIDE_PRESENT`
- [x] 5.2 若 `/help` 或 `--help` 输出中列出顶层命令，补上 `doctor`

## 6. 测试

- [x] 6.1 新增 `tests/unit/cli/doctor.test.ts`：
  - 无参自检：stdout 含 4 字段、exit 0
  - 带合法 skill path：追加 skill 字段、exit 0
  - SKILL.md 缺失：`SKILL_MD: MISSING` + `STATUS: FAIL` + exit 1
  - runtime/lib/main.ts 缺失：`RUNTIME_LIB_MAIN: MISSING` + exit 1
  - runtime/lib 缺文件：`RUNTIME_LIB_FILES: n/m` + exit 1
- [x] 6.2 更新 state `doctor` 子命令测试（stdout 不变、stderr 含 deprecation）
- [x] 6.3 `bun run build` 零 TS 错误
- [x] 6.4 `bun run test` 全部通过

## 7. 验证

- [x] 7.1 本地生成一份新 skill（`/export` 或 fixture），确认 SKILL.md 不再包含 Step 0 章节
- [x] 7.2 本地生成一份新 skill，运行 `soulkiller doctor <path>` 输出 `STATUS: OK`
- [x] 7.3 手动删除 fixture 的 SKILL.md，运行 `soulkiller doctor <path>` 输出 `STATUS: FAIL` + exit 1
- [x] 7.4 用一份旧版 skill（含 Phase 0 Step 0 模板）运行 `soulkiller runtime doctor`，确认 stdout 协议不变 + stderr 有 deprecation

## 8. Skill 升级路径

- [x] 8.1 定位 binary 内嵌的 `engine_version` 常量，bump 到下一版（e.g. `0.4.0`）
- [x] 8.2 确认 `runtime/engine.md` 模板生成逻辑读取同一常量；运行 `soulkiller skill upgrade` 对 fixture 老 skill 能正确覆盖 `runtime/engine.md` 并更新 `soulkiller.json.engine_version`
- [x] 8.3 验证 `soulkiller skill upgrade --all` 对同机多个 skill 都生效
- [x] 8.4 验证对已是最新版的 skill 执行 upgrade 输出 "already up to date"
- [x] 8.5 用一份无 `soulkiller.json` 的老 skill 跑首次迁移路径，确认生成的 SKILL.md / engine.md 都已应用新模板

## 9. 示例库重新生成

- [x] 9.1 写 `scripts/upgrade-example-skills.ts` 一次性脚本：解压 → `upgradeEngine(wrapper)` → 重新打包；复用 `soulkiller skill upgrade` 的核心逻辑，无需源数据重新 `/export`。`src/cli/skill-manager.ts` 把 `upgradeEngine` 改为 `export`。
- [x] 9.2 运行脚本后解包 `examples/skills/fate-zero.skill`：`engine.md` 中 `Step 0: Runtime Health Check` / `soulkiller runtime doctor` 字面量出现次数为 0，Step -1.1 为首个 step + Install Guide 分支存在
- [x] 9.3 三款 skill 的 `soulkiller.json` 全部为 `engine_version: 2`（与 `CURRENT_ENGINE_VERSION` 一致）
- [x] 9.4 跳过 — 本次不涉及 soul/world 数据层
- [x] 9.5 git commit `examples/skills/` 新版文件（commit 17b6f91），tag v0.3.7 已推送触发 CI 上传 R2
