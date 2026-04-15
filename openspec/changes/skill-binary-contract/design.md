## Context

**目前的契约隐形态**

| 原则 | 实现位置 | 状态 |
|------|---------|------|
| SKILL.md 只调 CLI，不 require 代码 | 模板 + 5 处 Never 禁语 | ✅ 符合 |
| Binary 是状态 CLI 唯一执行方 | `runtime.ts:13 import runCli from '../export/state/main.js'` | ✅ 符合 |
| Archive 不含可执行代码 | ❌ `injectRuntimeFiles` 塞 19 个 `.ts` 到 `runtime/lib/` | **违反** |
| 所有 mutation 经 CLI | 基本符合；但"load manual → 同步到 auto"缺命令 | **不完整** |

**`runtime-manifest-bundling`（上一 change）走了弯路**

那次的 ENOENT 错误是 `injectRuntimeFiles` 在 compiled binary 里炸；我当时加 manifest + CI smoke 修它。正确做法是**一开始就删掉 `injectRuntimeFiles`**——这些文件从不被 skill 运行时消费。回收基建是本 change 的一部分。

**"Load a Save" 数据一致性实锤**

对照代码：
```
engine.md Load-a-Save (line 144-167):        apply.ts (runApply):
───────────────────                          ──────────────────────────
用户选 manual:<ts>                            paths = resolveSavePaths(...)  // 总是 auto/
↓                                            state = readStateFile(paths)   // 读 auto/
validate --continue                          apply delta
↓                                            writeTransaction(paths, ...)   // 写 auto/
LLM Read manual/<ts>/state.yaml
↓
Phase 2 基于 manual 状态渲染
↓
apply ←─── 读 auto/，不是 manual！分叉！
```

**利益相关者**：
- **终端用户**：数据一致性（目前悄悄坏）
- **skill 作者**：archive 瘦身 / 无冗余
- **未来维护**：契约写在 CLAUDE.md，PR review 有锚点

**约束**：
- 不破坏老 archive：binary 仍读老 archive 的数据目录；老 `runtime/lib/` 忽略即可
- `load` / `save --delete` 的语义需在 engine.md 里清晰描述，避免 LLM 跳过

## Goals / Non-Goals

**Goals**

- Skill archive 严格限定为数据白名单
- 命令表面覆盖 skill 需要的**所有**状态 / 剧本 / 存档 mutation
- 清除 `runtime-manifest-bundling` 的基建（manifest、CI smoke 等）
- CI 自动阻断破坏契约的 PR
- 修复 Load-a-Save 的 timeline 分叉 bug

**Non-Goals**

- **不动** `runtime/engine.md`（prompt 数据，不是代码）
- **不动** `runtime/scripts/` 与 `runtime/saves/` 目录结构
- **不重新导出** 3 个 example skill 的内容——仅通过 upgrade 脚本剥离 `runtime/lib/`
- **不加**跨 skill / 跨 script 的 save 管理命令（超范围）
- **不引入** transactional "branch / fork save" 概念（未来再说）
- **不处理** export agent 的 world slug 命名 bug（独立 change）

## Decisions

### D1. 新命令语义与签名

**`soulkiller runtime load <script-id> <save-type>`**
- `<save-type>`: `auto` / `manual:<timestamp>`
- 作用：把指定 save 的 `state.yaml` / `meta.yaml` / `history.log` 拷贝覆盖 `auto/`
- 特例：`<save-type>` 为 `auto` 时报错（无意义）
- 幂等：可重复调；`auto/` 被整体 rewrite（含 `lastPlayedAt` 更新）
- 退出码：0 / 1 (manual 不存在) / 2 (参数错)
- stdout：`LOADED\n  source: manual:<ts>\n  target: auto\n  fields: N`

**`soulkiller runtime save --delete <timestamp> <script-id>`**（或 `save delete <ts> <id>`？）
- 决策：用 flag 形式 `save --delete <ts>`，保持 `save` 子命令语义完整；无 `<ts>` 还是原"创建快照"行为
- 删指定 `manual/<ts>/` 目录；不存在报错
- 退出码：0 / 1 / 2

**`soulkiller runtime script clean <id>`**
- 扫 `runtime/scripts/<id>/` 下的草稿（`plan.json`、`scene-*.json`、`ending-*.json`），删除
- 保留 `runtime/scripts/script-<id>.json`（已 build 的最终产物）
- 幂等：可重复；stdout：`CLEANED\n  drafts_removed: N\n  script_preserved: <path>`

**Why：**
- `load` 填最严重漏洞：Phase -1 manual 载入后的数据一致性
- `save --delete` 补齐 CRUD 最后一环：Create（save）、Read（list）、Update（save --overwrite）、Delete（save --delete）。对称完整
- `script clean` 处理"中途放弃 script 生成"的 orphan 文件——尤其在连续尝试不同 planning 思路时草稿会堆积

**Alternatives considered**：
- `restore` 代替 `load`：同义，但 `load` 更短且与常见游戏存档语义对应
- `save --delete <ts>` vs `delete-save <ts> <id>`：前者保持命令面小

### D2. archive 不含 `runtime/lib/` 之后，CI 怎么守护

**Choice**：新 CI job `verify-skill-archive-purity`：
1. 跑 dev 模式的 packager，产出一个 fixture .skill
2. 扫 zip 条目：断言 `.ts` 计数 === 0，`runtime/lib/` 前缀计数 === 0
3. 白名单校验：只允许 `SKILL.md` / `soulkiller.json` / `story-spec.md` / `souls/**` / `world/**` / `runtime/engine.md` / `runtime/scripts/.gitkeep` / `runtime/saves/.gitkeep`
4. 违反即 fail

**Why**：契约有"说法"（CLAUDE.md）+ "做法"（ CI 阻断）双轨。任何未来 PR 里有人尝试塞 code / 非白名单资产到 archive，本 job 立刻红灯。

**Alternatives considered**：
- 仅靠 unit test：unit 被 import 即跑；vs CI 专职 job 在 PR 页面直观可见
- 单测 + CI 都加：重复；CI job 主要报错阶段显眼，unit test 日常开发时同源检测

两者都要 —— unit test 在日常开发循环里快速反馈，CI job 作 PR gate。

### D3. Load-a-Save 流程改动

**Choice**：engine.md "Load a Save" 小节修改为：

```
1. 决定 save-type: auto 或 manual:<ts>
2. validate --continue
3. 若 save-type !== auto:
     soulkiller runtime load <id> <save-type>   ← 新步
4. Read runtime/saves/<id>/auto/state.yaml 到 context
5. Phase 2
```

注意 Step 4 现在永远 Read `auto/`（不再读 `manual/<ts>/`），因为 step 3 已把 manual 复制到 auto。单一数据源。

**Why**：
- 一致性：Phase 2 所有 apply 都基于 auto；LLM 的 context state 也来自 auto；magic 消失
- 命令语义清晰：`load` 就是"激活这个 save"

### D4. 老 archive 兼容

**Choice**：
- 老 archive 的 `runtime/lib/` 在磁盘上静默保留（binary 不读）
- `upgrade-example-skills.ts` 的 `DEPRECATED_PATHS` 追加 `runtime/lib/`；下次 example 升级时自动剥离
- 用户通过 `skill update` / `skill upgrade` 拿到新版 archive（无 `runtime/lib/`）即自然清理

**Why**：向后兼容 + 自然迁移，无需数据修复

### D5. 删除 `runtime-manifest-bundling` 基建

**保留 vs 删除清单**：

| 产物 | 操作 | 理由 |
|------|------|------|
| `src/export/state/manifest.ts`（117KB） | 删 | packager 不再 inject |
| `scripts/gen-state-manifest.ts` | 删 | 无需生成 |
| `tests/unit/export/state/gen-manifest.test.ts` | 删 | 测 generator 的 |
| `tests/unit/export/state/manifest-parity.test.ts` | 删 | 测 parity 的 |
| `tests/unit/export/packager-runtime.test.ts` | 重写 | 断言从"含 lib"翻到"不含 lib" |
| `src/index.tsx` `__runtime-manifest-check` | 删 | 没用 |
| `scripts/ci/compiled-export-smoke.ts` | 删 | 原本验 embedded，现不需要 |
| CI `verify-state-manifest` | 删 | — |
| CI `compiled-binary-smoke` | **改造** | 变成"binary launches + `runtime --help`"轻量 smoke |
| `package.json` `gen:state-manifest` 前置 | 删 5 处 | — |
| `scripts/build.ts` Phase 0 | 删 | — |
| `CLAUDE.md` Runtime asset bundling 段落 | **合并** | 并入新 Skill/Binary Contract 段落 |

**CI smoke 要留个"binary 自身 OK"的守护**：轻量版只跑 `--version` / `runtime --help` / `doctor`。重点移到 `verify-skill-archive-purity`（D2）。

### D6. 测试覆盖矩阵

| 风险 | 单测 | E2E | CI |
|------|------|-----|-----|
| archive 含 `.ts` / `runtime/lib/` | packager-contract.test.ts 白名单断言 | 24-exported-skill-purity.test.ts 解归档验 | verify-skill-archive-purity job |
| `load` 正确拷贝 | load.test.ts（单元） | 22-runtime-load.test.ts（走 binary） | e2e pipeline |
| `save --delete` 正确删除 | save-delete.test.ts | （复用 22 中的 setup） | e2e pipeline |
| `script clean` 只删草稿 | script-clean.test.ts | 23-script-clean.test.ts | e2e pipeline |
| Load-a-Save timeline 分叉 | （集成层）load.test.ts 内做 apply-after-load 断言 | 22-runtime-load.test.ts 场景 B | — |

### D7. 命令语义严格验证：输出格式

**Choice**：所有新命令遵循现有 pattern：
- 成功：stdout 为人类可读多行（`LOADED\n  source: ...`）或 JSON（`list` / `scripts` / `validate` / `save` 已是 JSON 的跟进）
- 失败：stderr 给错误；退出码 1
- 参数错：stderr 给 usage；退出码 2

`load` 与 `save --delete` 走人类可读格式（与 `init` / `apply` / `reset` / `rebuild` 同族）；`script clean` 同。

**Why**：一致性；便于 LLM parse（已有的 grep 模式不破）。

### D8. 实施过程中追加的决策

实施时挖出 4 个原 design 没覆盖但必须落的小事项，记于此供未来追溯：

**D8.1 `runtime/tree/` 加入白名单**

清理用户 fz-in-fate-zero 时发现 archive 含 `runtime/tree/server.json`——是 viewer 启动后写入的 PID 文件。viewer 服务的运行时数据在语义上等同 `runtime/scripts/` / `runtime/saves/`：binary 写、LLM 读。`ALLOWED_PREFIXES` 追加 `runtime/tree/`。同时禁止该目录下的可执行扩展名（沿用全局规则）。

**D8.2 `.DS_Store` basename 匹配**

老 archive 含来自开发者机器的 `.DS_Store`。原 `DEPRECATED_PATHS` 只有"前缀 / 完整路径"两种匹配，加第三种"basename"以剥离任意目录深度的元数据文件。规则：DEPRECATED_PATHS 项不含 `/` 即按 basename 匹配。

**D8.3 `runtime --help` 短路 SKILL_ROOT 检查**

`src/cli/runtime.ts` 原本无脑要求 `--root` 或 `CLAUDE_SKILL_DIR` 才往下走——`--help` / `-h` 也被卡在外。新机器或 install 后第一次 `soulkiller runtime --help` 看不到子命令清单。修：`--help` / `-h` / 无参短路，直接进 `runCli` 走 help 分支；其他子命令仍要求 SKILL_ROOT。

**D8.4 `__pack-fixture` 隐藏烟雾命令**

contract 验证最初只跑 dev 模式（vitest + 包脚本）；compiled binary 的 packageSkill 路径没真跑过。前次 runtime-manifest-bundling change 的教训：dev 跑过 ≠ binary 跑过。新增隐藏 cmd `soulkiller __pack-fixture <story> <soul> <world> <out>`：用户已有 soul/world 数据，binary 内嵌 packageSkill 执行，输出 .skill 到指定路径。验证流：`__pack-fixture` → 检 archive → `checkArchiveContract` 应返 0 violations。

未来可纳入 CI（需 fixture 数据准备成本）；本期手工跑过验证，已确认 binary 产物 58 文件全契约合规。

## Risks / Trade-offs

- **[老 skill 的 Load-a-Save 流程还有 bug]** → 新 engine.md 模板加 load 步；老 archive 的 engine.md 没这一步，仍会踩坑。解法：binary 的 `apply` 检测 "`auto/meta.yaml.lastPlayedAt` vs LLM 传入 scene 不匹配" 情景时打 warning？**暂不做**——范围更大，靠 `skill update` 拿新版 archive 即自然修复。
- **[`load` 覆盖 auto 有数据丢失风险]** → 用户可能在 auto 有未保存进度时不小心 load 了 manual。缓解：`load` 执行前检测 auto 存在且与 manual 不同，stderr 打 `WARNING: auto save will be overwritten`；继续执行。
- **[契约 PR 阻断开发]** → `verify-skill-archive-purity` 如果过严，添新类合法 archive 条目时 job 直接挂。缓解：白名单以 prefix 表达（`souls/`、`world/`、`runtime/engine.md`、`runtime/scripts/`、`runtime/saves/`），加新类资源时显式改 CI + CLAUDE.md。
- **[CLAUDE.md 段落臃肿]** → 顶级 section 要求"契约级"表述；不塞细节。细节仍放到 "Export / Skill format" 等段落里。

## Migration Plan

**阶段 1：契约文档先行**
1. `CLAUDE.md` 顶部（"## What is Soulkiller" 后紧跟）插入 "## Skill / Binary Contract (Invariant)" 段落

**阶段 2：新命令实现**
2. `src/export/state/load.ts` + `main.ts` 分支
3. `src/export/state/save.ts` 扩 `--delete`
4. `src/export/state/script-builder.ts` 新增 `runScriptClean`
5. 配套单测

**阶段 3：engine.md + SKILL.md 模板更新**
6. `src/export/spec/skill-template.ts` / `generateEngineTemplate` 更新 "Load a Save" + 新命令引用

**阶段 4：删除 runtime-manifest-bundling 基建**
7. 删 manifest / generator / parity 单测 / `__runtime-manifest-check`
8. 删 CI `verify-state-manifest`；改造 `compiled-binary-smoke`
9. 删 packager `injectRuntimeFiles`
10. 改写 `tests/unit/export/packager-runtime.test.ts`：断 archive **不含** runtime/lib

**阶段 5：契约 CI 守护**
11. 新 unit test `packager-contract.test.ts`（白名单验）
12. 新 CI job `verify-skill-archive-purity`

**阶段 6：老 archive 处理**
13. `upgrade-example-skills.ts` 的 `DEPRECATED_PATHS` 追加 `runtime/lib/`
14. 跑一次清本仓库 3 个 example

**阶段 7：E2E**
15. `22-runtime-load.test.ts` / `23-script-clean.test.ts` / `24-exported-skill-purity.test.ts`
16. `17-skill-update.test.ts`（若引用到 runtime/lib 结构）同步

**Rollback**：阶段独立；阶段 2-3 完成但 4-5 未做也可工作（新命令可用，契约未强制）。

## Open Questions

1. **load 覆盖 auto 的安全阀**：是否加 `--force` flag 让 warning 变 abort？MVP 不加；观察使用。
2. **script clean 是否 prompt 确认**：CLI 上当前所有命令都是无条件执行（无交互）；保持一致，不加 prompt。engine.md 侧可以写"确认前问用户 via AskUserQuestion"。
3. **CLAUDE.md 顶级段落放 "What is Soulkiller" 之前还是之后？** 之后（契约属于 how-to-build）更合适。
4. **是否给 `save --delete` 对称一个 `load --delete`？** 无意义——auto 不该被显式删；需要清零走 `reset`。
