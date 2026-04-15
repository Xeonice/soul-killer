## Context

现状（截至提案时）：

- `src/cli/skill-install/` 提供安装管道：`downloader.ts` → `extractor.ts` → `installer.ts`（rename→.old-<ts> 原子替换 + 回滚）；`orchestrator.ts` 串联。
- `src/cli/catalog/` 维护 catalog fetch + cache；`CatalogV1.skills[i]` 每条都带 `version: string` 和 `engine_version: number`。
- 已装 skill 根目录下有 `soulkiller.json`，由 `extractor.ts:42-50` 解析，字段包含 `engine_version` 和（应有的）`version`。
- REPL `/install`（`commands/system/install.tsx`）是线性 wizard：pick-skills → pick-targets → pick-scope → preview → installing → done；`overwrite` 硬编码 `useState(false)`。
- 已有 `scripts/upgrade-example-skills.ts` 一次性升级 `examples/skills/*.skill` 的 engine.md + soulkiller.json，但**不剔除废弃路径**（如 `runtime/bin/`）。
- 已有 spec `skill-upgrade` 定义 `soulkiller skill upgrade` —— 本地 engine 迁移，不触网、不改 skill 版本。命名与本提案的 `skill update`（catalog 版本升级、触网）形似但语义完全不同。

利益相关者：

- **终端用户**（装过 skill、想升级 / 卸载 / 看版本）。
- **skill 作者**（改了 SKILL.md 模板，想确认 example 跟进）。
- **CI / release pipeline**（需要在 catalog publish 前保证 example 新鲜）。

约束：

- 不引入新 npm 依赖（现有 fflate 足够）。
- 新 CLI 子命令必须在非 TTY 环境下（CI、脚本）正确工作，输出支持 `--json`。
- REPL UI 改造不得破坏现有 e2e 测试快照——UI 文案可变，但步骤序列（至少 Available 路径）需保持兼容。
- `install` 现有行为不变（`--overwrite` 语义继续有效），`update` 是新命令。

## Goals / Non-Goals

**Goals:**

- 让"发现新版 → 升级已装"成为一行命令（CLI）或两次按键（REPL）。
- REPL 用户无需记住任何 flag，就能完成升级 / 追装 / 卸载。
- CLI 输出对 CI 友好：`--json` + 显式退出码语义。
- 废弃路径（skill-runtime-binary 之后的 `runtime/bin/` 等）在仓库内 example 里有强制回收通道。
- 所有操作可回滚：update / uninstall 都走 rename→`.old-<ts>` 备份，失败自动还原。

**Non-Goals:**

- **不重写** `soulkiller skill install` 现有语义——保持向后兼容。
- **不合并** `skill update`（catalog 版本升级）与 `skill upgrade`（engine 本地修复）为单一命令；两者并存并在 `--help` 中明确区分。
- 不实现跨主机 skill 同步、skill 签名验证、私有 catalog 鉴权（另文）。
- 不引入 package lock 文件或版本锁定机制（每次 `update` 都拿 catalog 最新版）。
- 不处理"用户手动编辑了 skill 目录内容"的检测（MVP 信任 `soulkiller.json`，未来再加 sha256 比对）。

## Decisions

### D1. `install` vs `update` 分开成两个命令

**Choice:** 保持 `skill install` 语义不变；新增 `skill update` 专门做已装 skill 的 catalog 版本升级。

**Why:**
- 语义清晰：`install` 面向"第一次 / 新 target"，`update` 面向"已装升级"。
- CI 好写：`skill update --all --check` 返回非零即代表有更新可拿，可直接 gate 流水线。
- 降低手滑风险：`install --overwrite` 对已存在目录是"同版本覆盖"，`update` 会先校验版本 diff。
- 对齐主流包管理器心智（npm / cargo / pnpm 都是 install/update 分开）。

**Alternatives considered:**
- *Homebrew 模式*（`brew install` 对已装自动升级）：合并命令虽然少记一个词，但会让"我就想重装当前版本"和"我就想升到新版"失去语义区分，`--overwrite` 要表达的东西变重。
- *仅加 `--upgrade` flag 到现有 `install`*：可行但发现性差，`skill --help` 里看不出"能升级"这件事。

### D2. `skill update` 与现有 `skill upgrade` 命名共存

**Choice:** 并存。`skill update` = 从 catalog 拉新版本；`skill upgrade` = 本地 engine.md 同步二进制内嵌模板。两个命令的 `--help` 互相交叉引用对方，说明各自用途。

**Why:**
- `skill upgrade` 已在 spec `skill-upgrade` 中定义并实现，改名会造成脚本 / CI 兼容破坏。
- 英文 update/upgrade 虽近义，但搭配 catalog vs engine 两个 scope 后实际语义不同：update=remote bump，upgrade=local repair。
- 文档里用表格明确划分：

  | 命令 | 数据来源 | 网络 | 触发时机 |
  |------|---------|------|---------|
  | `skill update` | catalog | 需要 | 作者发布新版 |
  | `skill upgrade` | 本地二进制 embed | 不需要 | soulkiller 二进制升级后 |

**Alternatives considered:**
- *重命名 `skill upgrade` → `skill migrate` / `skill sync-engine`*：更清晰但是 breaking change，且现有 `repl-upgrade` spec 中还有 `/upgrade` REPL 命令也要改。成本大于收益。
- *合并成 `skill update` 一个命令，内部既拉新版又改 engine.md*：逻辑耦合，`--check` / `--dry-run` 语义会变复杂。

### D3. 共享核心抽成三个纯模块

**Choice:** `scanner.ts` / `diff.ts` / `uninstaller.ts` 做成**纯函数 + 显式 IO 注入**的模块，CLI 和 REPL 共享同一契约。

**Module shapes:**

```ts
// scanner.ts
interface InstalledSkill {
  slug: string
  installs: InstallRecord[]   // 同一 slug 可能在多个 target/scope 下安装
}
interface InstallRecord {
  target: TargetId            // 'claude-code' | 'codex' | 'opencode' | 'openclaw'
  scope: Scope                // 'global' | 'project'
  path: string                // absolute dir
  version: string | null      // from soulkiller.json
  engineVersion: number | null
  hasLegacyRuntimeBin: boolean  // runtime/bin/ 是否残留（诊断用）
}
function scanInstalled(opts: { cwd?: string; roots?: Array<{target, scope}> }): InstalledSkill[]

// diff.ts
type UpdateStatus =
  | { kind: 'up-to-date' }
  | { kind: 'updatable'; from: string; to: string }
  | { kind: 'unknown-version'; reason: 'no-soulkiller-json' | 'no-version-field' }
  | { kind: 'not-in-catalog' }
interface SkillDiff {
  slug: string
  status: UpdateStatus
  coveredTargets: Array<{target, scope}>
  missingTargets: Array<{target, scope}>  // catalog 无法告知，基于用户请求计算
  perInstallStatus: InstallRecord & { status: UpdateStatus }
}
function diffAgainstCatalog(installed: InstalledSkill[], catalog: CatalogV1): SkillDiff[]

// uninstaller.ts
interface UninstallOptions { path: string; backup: boolean }
function atomicUninstall(opts: UninstallOptions): { backupPath: string | null }
```

**Why:**
- CLI 命令和 REPL action 都只是**表现层**，核心决策在纯函数里——易测、易单元化。
- `InstallRecord` 粒度到 `(slug, target, scope)` 三元组，天然支持"同一 slug 在不同 target 上版本不一致"的场景。
- `hasLegacyRuntimeBin` 字段让 `skill info` / `skill list --updates` 可以识别"虽然版本号相等但有结构残留"的老包，给出修复建议。

### D4. Uninstall 用 rename→`.old-<ts>` 而非 `rm -rf`

**Choice:** 卸载 = rename destination 到 `<path>.old-<ts>`，与 `installer.ts` 现有备份策略对称。

**Why:**
- 意外拔错立即可恢复（`mv <path>.old-<ts> <path>`）。
- 磁盘空间由现有 `cleanupStaleOld()`（`src/index.tsx`）统一清理，不需要新增 GC 任务。
- 失败回滚简单：rename 失败直接退出；操作过程中出错就 rename 回去。

**Alternatives considered:**
- *直接 `rm -rf` + 用户有 git / Time Machine*：不对称，且 skill 目录通常在 `~/.claude/skills/` 不受 git 管。
- *移到系统回收站*：跨平台 API 不统一（macOS Finder API / Windows SHFileOperation / Linux 看 DE），引入的复杂度不值。

### D5. REPL `/install` 双 Tab UI 状态机

**Top-level phase:**

```
loading
  ↓  (catalog + scanner.scanInstalled 并发完成)
browsing
  ├─ tab: 'available'  → AvailableFlow（现有 wizard，封装成子状态机）
  └─ tab: 'installed'  → InstalledFlow（list → action menu → confirm → execute）
```

**Tab 切换键：** `Tab` / `Shift-Tab`。`Esc` 在 Tab 层退出命令；在子流里先回到 Tab 层。

**Available 过滤规则：**
- `diffAgainstCatalog` 对每条 catalog entry 计算覆盖情况。
- 用户**选择了 target** 后再过滤（因为 MVP 的 target 选择在 wizard 里，过滤要等到 pick-targets 之后）——Available tab 默认列全量，但用徽章 `[✓ all]` / `[追装]` 标注状态，让用户在 pick-skills 阶段就能看到。
- `Installed` tab 列出已装，加操作入口，避免 Available tab 承载过多 action。

**Installed action menu（slug 选中后）：**
```
╭─ fate-zero  v0.3.1 → v0.4.0  [cc global]  ─╮
│  ❯ Update to v0.4.0                         │
│    Install to other targets                  │
│    Details                                   │
│    Uninstall                                 │
│    ← Back                                    │
╰──────────────────────────────────────────────╯
```

选 `Uninstall` 必须二次确认（"确定要卸载 fate-zero [cc global]？备份到 …old-<ts>"），`Y/Enter` 执行；CLI 无二次确认。

### D6. CLI 输出：文本默认 + `--json` 机器可读

**Choice:** 所有新子命令（`list` / `update` / `uninstall` / `info`）默认输出对齐的文本表；`--json` 时输出 `{ "installed": [...], "catalog_source": "...", "errors": [...] }` 结构。

**Why:**
- CI / 脚本能直接 `jq`，不用正则 parse 表格。
- `update --check --json` 适合 PR/release pipeline 作为状态接口。
- 失败也输出 JSON（`{ "errors": [{"slug": "...", "message": "..."}] }`），stdout JSON + 退出码组合判定。

### D7. `skill update` 的幂等策略

**Choice:** `update` 每次比对 catalog version 字符串（严格相等判定 "up to date"）；新版即下载 + 覆盖；找不到 catalog 条目则报错并提示 `install`。

**Why:**
- 版本字符串就是契约（catalog 作者负责单调递增）；不引入 semver 解析复杂度。
- 避免 "same version but different contents" 的歧义——若作者 re-publish 同版本号需自增版本，是健康的发布纪律。

**Edge cases:**
- 本地 `soulkiller.json` 缺 `version` 字段 → `{ kind: 'unknown-version' }`，默认跳过；`--force` 强制重装。
- `--check` dry-run：列出计划动作，不落地；`--exit-code-if-updates` 发现更新时返回 1。

### D8. Example skill 刷新：升级脚本 + CI 守护

**Choice:** 扩展 `scripts/upgrade-example-skills.ts`：

1. 维护废弃路径规则集（起点：`runtime/bin/state`、`runtime/bin/doctor.sh`、`runtime/bin/` 空目录）。
2. 升级流程：unzip → bump engine.md + soulkiller.json → 剔除废弃路径 → repack。
3. 新增 `--check` 模式：不写文件，若任一 example 有 diff 则非零退出、打印 diff 摘要。

**CI 集成：** 新增 `.github/workflows/verify-examples.yml`（或合并到现有 `publish-catalog.yml`），在 PR 触发 `examples/skills/**` + `src/export/**` + `scripts/upgrade-example-skills.ts` 任一变化时跑 `--check`，失败即阻断。

**Why:**
- 本提案的 `skill-manage` 让终端用户有工具发现已装 skill 过期，但**仓库内 example 的过期**影响范围更大（新手从 README 按图索骥就会装到老包）。
- CI check 是强制机制；靠人记得跑升级脚本是不靠谱的（当前情况就是证明）。

**Alternatives considered:**
- *每次 release 自动提交升级*：可行，但改动被 release bot 吞会让 reviewer 漏看，容易累积静默偏差。主动 gate 更透明。
- *从源头 soul / world 完全重新 export*：需要源素材进仓库，成本高；现有脚本只改 engine 层已经能解决 90% 的过期问题。

## Risks / Trade-offs

- **[命名混淆 update vs upgrade]** → `--help` 输出用表格对比；在 `/upgrade`（REPL 二进制升级）完成后提示"`/install` 可以看 skill 的升级状态"形成引导；README 专门一段讲三个词（update/upgrade/install）。
- **[版本字符串不规范]** → catalog 作者若乱填 version（如 "v1" / 日期），`update` 仍能工作（字符串不等即视为新版），但无法表达"回滚"。提案不解决，遵循作者自觉；未来可加 semver 校验作为 lint。
- **[scope=project 扫描爆炸]** → 理论上每个 project 目录都可能有 `.claude/skills/`，全盘扫不现实。MVP 只扫 cwd 的 project scope + 全部 global；`skill list --scan-dir <path>` 允许用户指定。
- **[Uninstall 备份累积磁盘占用]** → 复用现有 `cleanupStaleOld()` 机制：对 `.old-<ts>` 文件，启动时清理 7 天以上的。需验证该清理器是否覆盖 skill 目录（目前是二进制目录专用），若不覆盖则扩展。
- **[REPL UI 回归]** → 双 Tab 架构改动面较大，现有 e2e 测试需同步更新。策略：保留 Available tab 为默认入口，现有 wizard 步骤序列尽量不动，只在最外层加 Tab 层。
- **[CI `verify-examples` 在 fork PR 上失败扰民]** → 在工作流里加 `if: github.event.pull_request.head.repo.full_name == github.repository` 或使用可写权限 token；检测到外部 PR 则只警告不阻断。

## Migration Plan

**阶段 1：共享核心（无用户可见变化）**

1. 实现 `scanner.ts` / `diff.ts` / `uninstaller.ts`，单元测试覆盖。
2. `installer.ts` 不动（已可用）；仅暴露 `InstallRecord` 的公共类型给两个 consumer。

**阶段 2：CLI 子命令（向后兼容）**

3. 扩展 `src/cli/skill-install/cli.ts`，加入 `list` / `update` / `uninstall` / `info` 分发；`install` 保持不变。
4. 更新 `--help` 输出。
5. 加入 `--json` 契约与 e2e fixture。

**阶段 3：REPL 双 Tab 改造**

6. 重构 `install.tsx`：抽出 `<AvailableFlow />`，新增 `<InstalledFlow />` + `<SkillActionMenu />`，顶层 Tab 容器。
7. 移除 `overwrite: useState(false)` 硬编码；由 action 类型决定。
8. i18n 键补全。

**阶段 4：Example skill 守护**

9. 扩展 `scripts/upgrade-example-skills.ts`：废弃路径剔除 + `--check` 模式。
10. 新增 `.github/workflows/verify-examples.yml`（或合并到现有 workflow）。
11. 当前一次性执行 `bun scripts/upgrade-example-skills.ts` 清理仓库里已过期的 `examples/skills/fate-zero.skill` 等。

**Rollback:** 每个阶段独立可回滚；若 REPL UI 改造引入回归，可 revert 阶段 3 commit 并保留阶段 1-2 的 CLI 能力。

## Open Questions

1. `skill list --catalog` 和现有 `soulkiller catalog list`（`src/cli/catalog/cli.ts`）是否合并？建议合并到 `skill list --catalog`，`catalog list` 标记 deprecated 但保留一版；具体由 tasks.md 决定。
2. `skill update --all` 遇到部分成功部分失败时退出码：目前定为 `1`（任一失败）。是否需要 `--partial-ok` 容忍模式？暂不加，观察用户反馈。
3. `runtime/bin/` 剔除是否算"skill 结构破坏性变更"需要 bump engine_version？倾向**不 bump**：engine_version 反映运行契约而非打包结构；清理老包是纯粹的 cleanup。若未来清理会改变运行时行为再 bump。
4. REPL Installed tab 是否也支持多选批量 Update？MVP 做单选 + 单 action，多选作为下一迭代。
