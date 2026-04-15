## 1. 共享核心模块（纯函数层）

- [x] 1.1 新增 `src/cli/skill-install/scanner.ts`：定义 `InstalledSkill` / `InstallRecord` 类型；实现 `scanInstalled({ cwd?, roots? })` 遍历 4 target × 2 scope；识别 `runtime/bin/state` / `runtime/bin/doctor.sh` 设置 `hasLegacyRuntimeBin`
- [x] 1.2 新增 `src/cli/skill-install/diff.ts`：定义 `UpdateStatus` / `SkillDiff` 类型；实现 `diffAgainstCatalog(installed, catalog)`；处理 `up-to-date` / `updatable` / `unknown-version` / `not-in-catalog` 四种状态
- [x] 1.3 新增 `src/cli/skill-install/uninstaller.ts`：实现 `atomicUninstall({ path, backup })`；rename→`<path>.old-<ts>` 备份路径；EXDEV 回退到递归复制+删除；失败 rollback
- [x] 1.4 单元测试：`tests/unit/cli/skill-install/scanner.test.ts`（覆盖单 target / 多 target / 缺 soulkiller.json / legacy runtime-bin 四种 fixture）
- [x] 1.5 单元测试：`tests/unit/cli/skill-install/diff.test.ts`（覆盖 4 种 UpdateStatus）
- [x] 1.6 单元测试：`tests/unit/cli/skill-install/uninstaller.test.ts`（覆盖 backup=true / false / 目标不存在三种场景）

## 2. CLI 子命令分发

- [x] 2.1 扩展 `src/cli/skill-install/cli.ts`：加入 subcommand 分派（`list` / `update` / `uninstall` / `info`）；保留现有 `install` 入口
- [x] 2.2 新增 `src/cli/skill-install/commands/list.ts`：实现 `skill list`；支持 `--catalog` / `--updates` / `--json` / `--scan-dir`
- [x] 2.3 新增 `src/cli/skill-install/commands/update.ts`：实现 `skill update <slug>...` / `--all` / `--check` / `--exit-code-if-updates` / `--force`；复用 `installer.atomicInstall({ overwrite: true })`
- [x] 2.4 新增 `src/cli/skill-install/commands/uninstall.ts`：实现 `skill uninstall <slug>`；支持 `--to` / `--scope` / `--all-targets` / `--no-backup`
- [x] 2.5 新增 `src/cli/skill-install/commands/info.ts`：实现 `skill info <slug>`；`--json` 切换
- [x] 2.6 在 `src/cli/skill-install/cli.ts` 的 `printUsage` 里补全新子命令段落；交叉引用 `skill upgrade`（engine 修复）与 `skill update`（catalog 升级）语义差异
- [x] 2.7 更新 `src/index.tsx` / 主 CLI 路由，确保 `soulkiller skill <subcommand>` 分派到新 handler

## 3. CLI e2e 测试

- [x] 3.1 `tests/e2e/16-skill-list.test.ts`：装 fixture skill → `skill list` 表格输出 / `--json` 结构 / `--updates` 过滤
- [x] 3.2 `tests/e2e/17-skill-update.test.ts`：fixture catalog 有新版 → `skill update <slug>` 覆盖成功、备份存在；`--check` dry-run 不写；`--exit-code-if-updates` 退出码 1
- [x] 3.3 `tests/e2e/18-skill-uninstall.test.ts`：`uninstall` 产生备份 / `--no-backup` 直接删 / `--all-targets` 全拔 / 未装退出码 1
- [x] 3.4 `tests/e2e/19-skill-info.test.ts`：文本 + JSON 输出验证；legacy runtime-bin 警告

## 4. REPL `/install` 双 Tab 改造

- [x] 4.1 抽取现有 wizard 为 `src/cli/commands/system/install-views/available-flow.tsx`（pick-skills / pick-targets / pick-scope / preview / installing / done）
- [x] 4.2 新增 `src/cli/commands/system/install-views/installed-flow.tsx`：列表 + action 菜单（含 details / add-targets / 二次确认 uninstall）
- [x] 4.3 Action 菜单合并进 installed-flow.tsx（保持单一状态机）
- [x] 4.4 改写 `src/cli/commands/system/install.tsx` 为 Tab 容器：`loading → browsing { tab }`；Tab 键切换
- [x] 4.5 移除 `useState(overwrite = false)` 硬编码；`overwrite` 由 action 类型决定（Update=true，Install/Available=false）
- [x] 4.6 Available Tab 列表加 `[追装]` / `[✓ all]` 徽章；pick-targets 步骤预勾选未覆盖 target 并以"（已装）"标注已覆盖
- [x] 4.7 Details 视图：列出 target / scope / path / version / engine / legacy-bin 警告

## 5. i18n 与文案

- [x] 5.1 CLI 子命令输出为英文（无需 i18n 键）；REPL UI 的 31 个新键已添加到 zh / en / ja
- [x] 5.2 `install.tab.available` / `install.tab.installed` / `install.action.*` / `install.hint_*` 键齐全
- [x] 5.3 `install.uninstall_confirm_*` / `install.hint_use_update` / `install.hint_all_installed` 引导文案完成

## 6. REPL e2e 测试

- [x] 6.1 / 6.2 `tests/e2e/20-install-tabs.test.ts` 合并覆盖：默认 Available Tab / Tab 切换 Installed / 仅显示 soulkiller skill（过滤 ai-sdk 等）/ Enter 打开 action 菜单 / Esc 返回；TestTerminal 加 `env` 注入 `SOULKILLER_CATALOG_URL`
- [ ] 6.3 Visual snapshot（`tests/visual/`）：Available / Installed 双 Tab 静态截图（deferred — Playwright + xterm.js 工具链独立，ROI 低）

## 7. Example skill 刷新与 CI 守护

- [x] 7.1 扩展 `scripts/upgrade-example-skills.ts`：加入 `DEPRECATED_PATHS` 规则集常量（起点：`runtime/bin/state`、`runtime/bin/doctor.sh`、`runtime/bin/`）；升级流程在 repack 前剔除匹配路径
- [x] 7.2 在 `scripts/upgrade-example-skills.ts` 添加 `--check` dry-run：计算 diff 但不写文件；发现过期则非零退出并列举每条 example 的过期原因
- [x] 7.3 扩展 `.github/workflows/ci.yml` 加入 `verify-examples` job：跑 `bun scripts/upgrade-example-skills.ts --check` 阻断 PR
- [x] 7.4 在 scanner 中加入 `scanFromArchive(zipPath)` + `scanExamples(dir)`：解开 `.skill` 到临时目录后复用 `scanInstalled` 的节点构造；target 字段标为 `"example"`
- [x] 7.5 `skill list --examples` 子命令：列出 `examples/skills/*.skill`；支持 `--examples-dir`
- [x] 7.6 首次执行：运行 `bun scripts/upgrade-example-skills.ts` 清理仓库内过期的 3 个 example 归档

## 8. 备份清理对齐

- [x] 8.1 抽取 `src/cli/cleanup.ts`，新增 `cleanupStaleSkillBackups()` 扫 4 target global 下 `.old-<ts>` 目录；index.tsx 启动时调用
- [x] 8.2 加 unit test 验证超过保留窗口（默认 7 天）的 `.old-<ts>` 被清理，未超时的保留

## 9. 文档

- [x] 9.1 更新 `README.md`：新增 "管理已装 skill" 一节，示例 `skill list` / `skill update` / `skill uninstall` / `skill info`
- [x] 9.2 `README.md` 和 `skill --help` 里说明 update vs upgrade 语义差异
- [x] 9.3 CLAUDE.md "Release & Distribution" 加入 Example skill freshness 一行说明（DEPRECATED_PATHS / `--check` / verify-examples job）
- [x] 9.4 更新 `src/export/state/main.ts:5-6` 过时注释（"bash wrapper" → "soulkiller runtime"）

## 10. 发布准备

- [x] 10.1 `bun run build`（tsc --noEmit）通过
- [x] 10.2 `bun run test` 全绿（99 files / 1085 tests），skill CLI e2e 全绿（26 tests / 5 files）
- [x] 10.3 手工验证（见 smoke test 输出）：`skill list` 显示 updatable / `skill uninstall` 产生 .old-<ts> 备份 / `skill list --examples` 识别 examples
- [x] 10.4 `openspec archive skill-manage-installed`：3 delta 同步（skill-manage / example-skills-refresh / skill-install 修改 2 Requirement），change 归档到 `openspec/changes/archive/`
