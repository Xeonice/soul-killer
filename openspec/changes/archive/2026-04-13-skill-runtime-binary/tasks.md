## 1. soulkiller runtime 入口

- [x] 1.1 新建 `src/cli/runtime.ts`：`runRuntime(args)` 函数，读 `CLAUDE_SKILL_DIR`（支持 `--root` 手动覆盖），用 `process.execPath`（非 argv[0]）spawn 自身 + `BUN_BE_BUN=1` 执行 `runtime/lib/main.ts`，透传 stdio 和 exit code
- [x] 1.2 修改 `src/index.tsx`：在 `--update` 之后、`render(<App/>)` 之前拦截 `args[0] === 'runtime'`，调用 `runRuntime`
- [x] 1.3 验证编译后二进制：`bun build --compile` → 测试 `./soulkiller runtime --help` 能正确执行外部 main.ts

## 2. tree server 跨平台

- [x] 2.1 修改 `src/export/state/tree.ts`：`spawn('bun', ...)` 改为 `spawn(process.execPath, ..., { env: { ...process.env, BUN_BE_BUN: '1' } })`
- [x] 2.2 修改 `src/export/state/tree.ts`：`runTreeStop` 中 `process.kill(pid, 'SIGTERM')` 改为跨平台分支（win32 用 `taskkill`）

## 3. packager 简化

- [x] 3.1 修改 `src/export/packager.ts`：`injectRuntimeFiles` 删除 doctor.sh 和 state.sh 打包逻辑，只保留 `runtime/lib/*.ts` 复制
- [x] 3.2 删除 `src/export/state/state.sh`
- [x] 3.3 删除 `src/export/state/doctor.sh`
- [x] 3.4 修改 `injectRuntimeFiles` 返回值：从 `Set<string>` 改为 `void`（或删除 execPaths 相关逻辑），同步修改调用方

## 4. SKILL.md 模板

- [x] 4.1 修改 `src/export/spec/skill-template.ts`：`buildPlatformNotice()` 更新支持平台列表（加 Windows，去掉 WSL 限制）
- [x] 4.2 修改 `buildPhaseMinusOne()`：Step 0 从 bash doctor 改为 `soulkiller runtime doctor`，删除 BUN_MISSING/BUN_OUTDATED/PLATFORM_UNSUPPORTED 分支，新增 "soulkiller not found" 安装指引分支
- [x] 4.3 批量替换 `buildMultiCharacterEngine()` 中所有 `bash \${CLAUDE_SKILL_DIR}/runtime/bin/state` → `soulkiller runtime`（约 20 处）
- [x] 4.4 批量替换 `buildSingleCharacterEngine()` 中同样的调用（约 17 处）
- [x] 4.5 修改 `buildSaveSystemSection()`：调用格式统一
- [x] 4.6 更新模板中的 "Prohibited Actions" / "Hard Red Lines" 段落：引用格式对齐

## 5. lint 规则

- [x] 5.1 修改 `src/export/support/lint-skill-template.ts`：`doctorMarker` 改为 `soulkiller runtime doctor`
- [x] 5.2 `applyMarker` 改为 `soulkiller runtime apply`
- [x] 5.3 `NO_EDIT_STATE_YAML` 规则的错误信息中 `bash runtime/bin/state` 引用更新

## 6. doctor 子命令增强

- [x] 6.1 修改 `src/export/state/main.ts`：doctor 分支输出增加 `SOULKILLER_VERSION`（从 `process.env.SOULKILLER_VERSION` 读取）和 `PLATFORM`（`process.platform-process.arch`）

## 7. 测试

- [x] 7.1 修改 `tests/unit/export/packager-runtime.test.ts`：删除 shell wrapper 打包相关断言（doctor.sh、runtime/bin/state 的可执行位检查），保留 `runtime/lib/*.ts` 复制断言
- [x] 7.2 修改 `tests/unit/export/lint.test.ts`：marker 字符串从 `runtime/bin/state doctor` / `runtime/bin/state apply` 改为 `soulkiller runtime doctor` / `soulkiller runtime apply`，所有测试用的 mock SKILL.md 片段同步更新
- [x] 7.3 修改 `tests/unit/soul/package-tools.test.ts`：删除验证 archive 含 `runtime/bin/state` + `runtime/bin/doctor.sh` 的断言
- [x] 7.4 修改 `tests/unit/soul/package.test.ts`：所有 `expect(result).toContain('runtime/bin/state ...')` 改为 `soulkiller runtime ...`
- [x] 7.5 新增 `tests/unit/cli/runtime.test.ts`：测试 `runRuntime` 的 CLAUDE_SKILL_DIR 缺失 / --root 覆盖 / main.ts 不存在 / 正常 spawn 的行为
- [x] 7.6 运行 `bun run test` 确认全部测试通过（87 文件 997 用例）
- [x] 7.7 手动验证：编译二进制 → 在一个 mock skill 目录下执行 `soulkiller runtime --root /path/to/mock doctor` / `soulkiller runtime --root /path/to/mock --help`

## 8. CLAUDE.md 更新

- [x] 8.1 更新项目 CLAUDE.md 中 Export / Skill format 段落：反映新的调用方式和架构变化
