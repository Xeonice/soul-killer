## Why

当前 `/install`（REPL）和 `soulkiller skill install`（CLI）只能"装"，不能"管"：
- 用户无法在 REPL 里看到"自己装了什么 / 哪些有新版"——必须记住 slug 再手敲 `install <slug> --overwrite`。
- CLI 没有 `list` / `update` / `uninstall` / `info` 子命令；发现新版要肉眼对比 `~/.claude/skills/<slug>/soulkiller.json` 和 catalog，体验为零。
- REPL `/install` 里 `overwrite` 被硬编码 `useState(false)`，UI 里没法升级已装 skill。
- 已装 skill 可能停留在历史版本（如 `examples/skills/fate-zero.skill` 这种带老 bash wrapper 的产物），缺少发现与修复通道。

底层基础其实已就位：catalog 每个 skill 带 `version` + `engine_version`；每个已装 skill 都有 `soulkiller.json` 记录版本；`installer.ts` 已有 rename→`.old-<ts>` 的原子替换 + 回滚。只差"扫描已装 + 版本 diff + 对称的卸载 + 对外命令面"。

## What Changes

**共享核心（供 CLI 和 REPL 复用）**
- 新增 `scanner` 模块：扫描全部 4 个 target × 2 个 scope（共 8 个目录）下的 `<slug>/soulkiller.json`，产出 `InstalledSkill[]`。
- 新增 `diff` 模块：`InstalledSkill × CatalogV1` → `{upToDate | updatable(from,to) | unknownVersion | targetGaps}`。
- 新增 `uninstaller` 模块：对称 `installer` 的 rename→`.old-<ts>` 备份 + 回滚。

**CLI 子命令扩展（`soulkiller skill …` 命名空间下）**
- 新增 `skill list` — 列出已装；`--updates` 仅显示有新版；`--catalog` 显示 catalog 全量；`--json` 机器可读。
- 新增 `skill update <slug>... | --all` — 对已装 skill 做 catalog 版本升级，幂等（最新即 skip）；`--check` dry-run；未装时报错提示 `install`。
- 新增 `skill uninstall <slug>` — 默认 `--to claude-code --scope global`；`--all-targets` 全拔；复用 rename→`.old-<ts>` 备份。
- 新增 `skill info <slug>` — 显示当前版本、catalog 最新版本、各 target 安装位置；支持 `--json`。
- `skill install` 保持向后兼容（语义不变，`--overwrite` 仍可用），但推荐用户使用 `skill update` 做升级。
- **退出码**：`0` 成功/无事可做；`1` 部分失败；`2` 参数错误；`update --check` 可选 `--exit-code-if-updates` 发现更新时返回 1（CI 友好）。

**REPL `/install` 双视图改造**
- 入口分 Tab：`Available`（可装）/ `Installed`（已装）。
- `Available` tab：现有 wizard 保留，但过滤"所有 target 都已装且是最新版"的条目；装了但某些 target 没覆盖的显示"追装"徽章。
- `Installed` tab：每行显示 slug / 当前版本 / 最新版本 / 已覆盖 target 徽章；单选进入 action 菜单：`Update / Install to other targets / Details / Uninstall / Back`。
- 移除 `overwrite` 硬编码：由 action 类型决定语义（`Update` → overwrite=true，`Install` → overwrite=false）。
- Uninstall 在 REPL 需要二次确认；CLI 非交互默认直接执行。

**与现有 `skill upgrade`（engine 迁移）共存**
- `skill upgrade`（现存 spec `skill-upgrade`）语义保持不变：本地修复/迁移 `runtime/engine.md` 与二进制 embed 同步，不触网。
- 新 `skill update` 语义：从 catalog 重新下载新版本 skill 包，覆盖安装。
- 两者命令名差异在文档中明确说明，避免混淆。

**仓库内 example skill 的更新通道**
- `examples/skills/*.skill` 目前是 build artifact，靠 `scripts/upgrade-example-skills.ts` 一次性升级，且只重写 `runtime/engine.md` + `soulkiller.json`，**不会移除已废弃的目录**（如 skill-runtime-binary 之后应当移除的 `runtime/bin/`）。
- 强化该脚本：除了 bump engine.md/soulkiller.json，新增"废弃路径剔除"规则集——目前至少包含 `runtime/bin/state` 与 `runtime/bin/doctor.sh`；规则在脚本里集中维护，未来废弃任何目录只需追加。
- CI 增加守护：在 `release.yml`（或单独的 `verify-examples.yml`）触发的 PR/release 流程里，跑 `bun scripts/upgrade-example-skills.ts --check`，若有 example 需要升级则失败并提示作者运行升级脚本提交。
- `skill-manage` 的 scanner / diff 模块在本地也要能扫 `examples/skills/*.skill`（unpack 到临时目录后复用同一逻辑），从而 `soulkiller skill list --examples` 可以本地发现"仓库内 example 是否过期"，与 CI 守护互为补充。

## Capabilities

### New Capabilities
- `skill-manage`: 已装 skill 的生命周期管理——扫描、版本 diff、更新、追装、卸载、详情查看；REPL 双视图 UI 与 CLI 子命令两套接口共享同一核心。
- `example-skills-refresh`: 仓库内 `examples/skills/*.skill` 的持续新鲜度保证——升级脚本支持废弃路径剔除；CI 守护 PR/release 时 example 过期即阻断。

### Modified Capabilities
- `skill-install`: REPL `/install` 入口从线性 wizard 改为 `Available / Installed` 双 Tab 容器；`Available` 默认过滤已覆盖全 target 的条目；移除 UI 内硬编码的 `overwrite=false`。CLI `skill install` 行为不变。

## Impact

**受影响代码**
- `src/cli/skill-install/` — 新增 `scanner.ts`、`diff.ts`、`uninstaller.ts`；扩展 `cli.ts` 子命令分发（`list`/`update`/`uninstall`/`info`）。
- `src/cli/commands/system/install.tsx` — 重构为 Tab 容器；新增 `<InstalledFlow />` + `<SkillActionMenu />`；现有 wizard 抽成 `<AvailableFlow />`。
- `src/cli/catalog/cli.ts` — `skill list --catalog` 可能替代或并列现有 `catalog list`（评估在 design.md）。
- `scripts/upgrade-example-skills.ts` — 扩展：加入"废弃路径剔除"规则集与 `--check` 模式（dry-run 且非零退出）。
- `.github/workflows/` — 新增或扩展 workflow，在 PR/release 流程里跑 `--check` 守护。
- i18n JSON — 新增 `skill.list.*` / `skill.update.*` / `skill.uninstall.*` / `skill.info.*` / `install.tab.*` 键。

**受影响 API / 文档**
- `soulkiller skill --help` 输出扩充子命令列表。
- README / 用户文档需更新"如何升级已装 skill"一节。

**依赖**
- 无新增 npm 依赖；所有能力基于现有 fs / catalog / installer 基础设施。

**数据 / 兼容**
- 无破坏性变更：旧 `.skill` 包（缺 `soulkiller.json` 或缺 `version` 字段）在 `list` 中显示为 `unknown` 版本，`update` 允许以 `--force` 覆盖。
- Uninstall 产生的 `.old-<ts>` 备份复用现有 `cleanupStaleOld()` 机制（或新增对称清理）。
