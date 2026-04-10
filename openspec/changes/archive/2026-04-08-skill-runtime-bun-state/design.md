## Context

Phase 2 的 `apply_consequences` 目前通过 SKILL.md 的 prompt 指令告诉 LLM 用 `Edit` 工具逐行修改 `state.yaml` 和 `meta.yaml`。已有防御层包括：`state_schema` 内联在 script.yaml 顶部作为契约、"Edit 而非 Write" 的行级替换规则、Phase -1 六重加载校验。这些机制抓得住**Edit 自爆型错误**（拼错 key、old_string 未命中），但抓不住**静默型错误**：clamp 算错、漏 consequences key、类型写错、state/meta 不同步、跳过 apply 整个调用。

对终态的共识：Soulkiller skill 的目标定位是 A 路线——**任意 Claude Code 用户下载即用的故事包**。但在与 explore 模式的反复推演后，决策者接受把 A 路线精化为"任意 **Unix-like** Claude Code 用户，首次一次性 bootstrap 后即用"。这个精化让引入 bun runtime 成为可能。

Claude Code skill 的运行时约束：skill 不能向宿主注册新工具，只能通过 `Bash` 工具调用归档内的可执行脚本。所以"引入工具"的唯一可行形态是"skill 归档里带可执行脚本 + bash wrapper"。

## Goals / Non-Goals

**Goals:**

- 把 `state.yaml` 和 `meta.yaml` 的写入职责从 LLM（容易漂移）转移给 TypeScript 代码（可测试、可根治）。
- 让 LLM 的心智模型只感知一个 `state` 工具，不感知 bun/ts/运行时等实现细节。
- 在 Phase -1 Step 0 用一个零依赖的 POSIX sh doctor 完成首次 bootstrap 判断，失败时降级到"只读模式 + 修复菜单"。
- 作者侧（Soulkiller 源码）和消费侧（导出的 skill 归档）**共享同一份 TypeScript 代码**，让 Soulkiller 的单元测试即消费侧的运行时测试。
- 消除错误类 B（clamp 算错）、C（漏 consequences key）、D（类型写错）、E（state/meta 不同步）。
- 保持 skill 归档本身的"静态文本分发"属性：归档内不打包 bun 二进制，首次运行时下载。

**Non-Goals:**

- 不追求 Windows 原生 shell 支持。Windows 用户被明确要求使用 WSL。doctor 检测到 win32 非 WSL 直接拒绝。
- 不追求与旧版（纯 prompt 驱动）skill 归档的向后兼容。一次性干净切断。
- 不在脚本里引入任何 `node_modules` / npm 依赖。state.yaml 的 yaml 解析由一个内联的 `mini-yaml.ts` 处理（因为 state.yaml 的行格式已经锁死成扁平 `"quoted-key": value`）。
- 不解决错误类 F（LLM 跳过整个 apply 调用）——脚本只能在"被调用时"保证正确，F 仍然依赖 prompt 约束 + Phase -1 审计。
- 不修改 Phase 1 的 `state_schema` 创作约束、命名规则、consequences 引用规则。这次重构只改"运行时谁写状态"，不改"状态的格式"。
- 不修改 story-spec.md / characters/ / world/ / runtime/scripts/ 的内容或位置。
- 不把 consequences 计算能力做成 LLM 可动态扩展的东西——consequences 仍然是 Phase 1 写进 script.yaml 的静态数据，apply.ts 只是忠实执行它。

## Decisions

### Decision 1: Bootstrap 粒度——全机一次 + 每 Phase -1 心跳检查

**选择**: 粒度 A（全机一次安装 bun）+ 粒度 C（每次 Phase -1 心跳检查 `command -v bun`）。

**备选**:
- 粒度 B（每 skill 独立 bootstrap）——被排除。每个 skill 自带 bootstrap 会让 skill 看起来"很重"，也不利于 Soulkiller 生态内多个 skill 共享运行时。
- 粒度 C 独用——不够，第一次运行时没有任何引导。

**原理**: 第一次运行时由 doctor 发现缺失并引导用户安装 bun；之后每次 Phase -1 只做一次 `command -v bun` 心跳，成本近似零。bun 装到 `$HOME/.soulkiller-runtime/` 而不是 `$HOME/.bun`，避免与用户可能已有的 bun 版本冲突，也避免污染用户的 `.zshrc` / `.bashrc`。

### Decision 2: Auto-install 档位——LLM 协助（档位 2）

**选择**: LLM 用 AskUserQuestion 提供三个选项：
1. "我来帮你装" → LLM 调用 `Bash` 执行 `curl -fsSL https://bun.sh/install | BUN_INSTALL=$HOME/.soulkiller-runtime bash`
2. "我自己装，告诉我命令" → 展示完整命令 + bun.sh 官方链接，等用户确认后重新 doctor
3. "取消" → 进入只读模式或退出

**备选**:
- 档位 1（全手动）——用户必须切窗口，体验差，而且最终执行的是同一条 curl 命令，"更安全"是错觉。
- 档位 3（静默 auto-install）——越权，违反 Claude Code skill 的信任边界。

**原理**: Claude Code 的 `Bash` 工具本来就有用户授权层——LLM 跑 `curl | bash` 和用户手动跑是同一条命令，差别只在谁按回车。档位 2 的信任链是"用户明示同意 → LLM 执行 → Bash 权限系统二次 gate"，比档位 1 的"用户切窗口自己跑"多一层审计但少一层摩擦。

### Decision 3: Windows 方案——α（仅 WSL）

**选择**: doctor.sh 在检测到 `uname -s` 含 `MINGW` / `MSYS` / `CYGWIN` 或 `$OSTYPE == msys` 时直接拒绝，返回"请在 WSL 中使用本 skill"的引导。

**备选**:
- β（尽力而为，提供 PowerShell 安装命令）——双份 wrapper 维护成本高；Git Bash 环境下 PATH 行为不稳定；Claude Code 在 Windows 原生 shell 中的 Bash 工具实际行为未充分验证，夹生兼容反而制造更多 bug 报告。

**原理**: 把限制写在脸上比装作全平台兼容更尊重用户。Soulkiller 的目标用户群（愿意在 Claude Code 里玩 AI 视觉小说）中，Windows 原生 shell 用户是极小部分，他们大概率也熟悉 WSL。

### Decision 4: 运行时布局——`runtime/bin/` 和 `runtime/lib/` 平级

**选择**:
```
runtime/
├── bin/                 LLM 面向的 API 面
│   ├── state            bash wrapper（LLM 调用的唯一入口）
│   └── doctor.sh        纯 POSIX sh 健康检查
└── lib/                 实现层（LLM 不接触）
    ├── main.ts          CLI dispatcher
    ├── apply.ts         state apply 命令
    ├── init.ts          state init 命令
    ├── validate.ts      state validate 命令（6 重 + 第 7 重）
    ├── rebuild.ts       state rebuild 命令
    ├── reset.ts         state reset 命令
    ├── schema.ts        StateSchema 类型 + applyDelta 纯函数
    ├── script.ts        script.json 加载器（JSON.parse 包装）
    ├── io.ts            原子事务性 fs 写入（temp-file + rename）
    └── mini-yaml.ts     扁平 yaml parser/serializer
```

**备选**:
- `runtime/bin/lib/`（嵌套）——把实现藏在 bin 子目录下，概念上不如平级清晰。
- `runtime/scripts/bun/` 等——和已有的 `runtime/scripts/` 命名撞车。

**原理**: 遵循 Unix `/usr/bin` + `/usr/lib` 传统。`bin/` 只放 LLM 会直接 `bash` 调用的文件，`lib/` 放实现细节。这让 LLM 的 prompt 可以简单地描述为"通过 `bash runtime/bin/state ...` 调用"，而不需要向 LLM 解释 bun 或 ts。

### Decision 5: 工具 API 契约——六个子命令，无 `get` / `set`

**选择**:
```
state doctor                          健康检查 + 首次 bootstrap
state init <slot> <script-id>         从 script.initial_state 初始化
state apply <slot> <scene> <choice>   事务性状态转移
state validate <slot>                 返回 JSON 诊断（不自动修复）
state rebuild <slot>                  重建 state.yaml（修复用）
state reset <slot>                    "从头再来"
```

**关键约定**:
- **不提供 `state get`**：LLM 直接用 `Read` 读 state.yaml 就行，格式本来就人类可读。
- **不提供 `state set key value`**：避免 LLM 绕过 consequences 系统捏造状态变化。**所有写入必须经过语义命令**。
- **`state apply` 的入参是 scene + choice，不是 consequences patch**：consequences 已经在 script.yaml 里写死了，apply.ts 从 script 里读出来自己算。LLM 完全不参与 consequences 计算，这是**责任下沉的核心**。
- **`state validate` 只诊断不修复**：返回 JSON 结构化诊断，修复流程依然由 LLM 通过 AskUserQuestion 驱动（复用现有的 Phase -1 修复菜单交互）。

**备选**: 让 `state apply` 接受 LLM 生成的 JSON patch 作为入参。拒绝原因：这样 LLM 依然在算 delta，脚本只是 sanitizer——本次重构的核心收益就消失了。

### Decision 6: 共享代码源——`src/export/state/` 既是作者侧又是消费侧

**选择**: `src/export/state/*.ts` 是 Soulkiller 源码的一部分，受 Soulkiller 的 vitest 单元测试覆盖。packager 在打包 skill 时把这些 `.ts` 文件**原样拷贝**（不做 bundle / transpile）到归档的 `runtime/lib/`。bun 能直接执行 `.ts`，所以无需构建步骤。

**原理**:
- 作者侧的 `bun vitest run tests/unit/export-state-*.test.ts` 测试的就是消费侧 skill 运行时跑的同一份代码。
- 一份 bug fix 在下一次 `export` 时自动传播到所有新导出的 skill。
- 不需要 Soulkiller 维护两套：一套源码、一套打包好的 runtime。
- 所有 `.ts` 只允许用 bun stdlib（`Bun.file` / `fs` / `path`），禁止 npm 依赖——这是"skill 不需要 `bun install` 步骤"的基础。

**备选**: 在 Soulkiller 源码和 skill 归档里放两份实现。拒绝：双实现漂移是灾难。

### Decision 7: 解析策略——mini-yaml 处理 state/meta，JSON 处理 script

**选择**:

- `state.yaml` 和 `meta.yaml`：用 ~40 行的 `mini-yaml.ts` 解析，只支持扁平 `"<quoted-key>": <value>` 结构。这两个文件要保留"人类一眼看懂存档"的可读性。
- `script-<id>.json`：用 `JSON.parse`（bun stdlib 内置，零代码）解析。**script 从 yaml 改成 json**。

**原理**: 实施阶段发现 script.yaml 含嵌套 mapping / block sequence / 数组等结构，mini-yaml 完全无法处理；而在 `runtime/lib/` 严格禁止 npm 依赖的前提下，bun stdlib 没有 runtime yaml parser。三个选项：

1. **选项 A**：在 runtime/lib 里写一个 mid-size YAML subset parser（200-400 行）——parser 是 bug 温床，LLM 生成有创意时容易炸
2. **选项 B（已选）**：script 改成 JSON——`JSON.parse` 零维护、零漂移
3. **选项 C**：export 时做 yaml→json 转换——本质是选项 A 的变种

**script.json 的合理性**: script 文件是 LLM 写给 LLM 看的结构化数据，不是作者手写。JSON 的可读性与 yaml 对这类场景基本相当，但解析成本趋近于零。

**风险与缓解**: 旧 script.yaml 彻底不兼容——这一点和 proposal 的 BREAKING 声明一致。所有旧 skill 归档统一作废，不提供回退开关。

### Decision 11: script 文件扩展名——改为 `.json`

**选择**: `runtime/scripts/script-<id>.json`，不保留 `.yaml` 扩展名伪装。

**原理**: 诚实。文件扩展名反映文件真实格式。保留 `.yaml` 扩展但内容是 JSON 会让读文件的工具（编辑器高亮、yaml linter）混乱。改扩展名是零成本的决策。

**影响**: Phase -1 列举存档时匹配 `runtime/scripts/*.json`；Phase 1 写 `script-<id>.json`；packager 的 empty `.gitkeep` 路径不变。

### Decision 8: `state.yaml` 和 `meta.yaml` 的写入由脚本独占

**选择**: 删除"唯一允许 Write 整个 state.yaml 的两个时机"条款。新规则：**LLM 永远不用 Edit / Write 直接写这两个文件**。所有写入都通过 `state init` / `state apply` / `state reset` / `state rebuild`。

**事务性**: apply.ts 一次调用同时写 state.yaml 和 meta.yaml，两个文件要么都更新要么都不更新。实现方式是先写到临时文件再 `rename`（fs.rename 是原子的）。

### Decision 9: 错误降级路径——只读模式

**选择**: 如果 doctor 失败（用户拒绝安装 / 网络不通 / 平台不支持），Phase -1 进入"只读模式"：禁用 `state apply`（也就是禁止进入 Phase 2 的状态转移），但允许：
- Phase -1 列出已有 script
- 阅读已存在的 save 状态（LLM 用 Read 直接读）
- 看结局图鉴（Phase 3，如果已到达过结局）

**原理**: 这保留了一部分 A 路线的"文本包"属性作为 fallback。用户在完全没装 bun 的环境下依然能看之前存过的剧情和结局，只是不能继续玩或新建存档。

### Decision 10: 信任事件的透明度

**选择**: 第一次 AskUserQuestion 的 question body 必须包含：
1. 完整的 curl 命令（不折叠、不缩写）
2. bun 官方链接 `https://bun.sh`
3. 安装目录 `$HOME/.soulkiller-runtime/`
4. 大小预估 `~90MB`
5. 下一句话：`你可以随时删除该目录以完全卸载`

**原理**: 信任事件要显式、可验证、可回滚。用户能自己验证 URL 合法性，能自己决定是否信任，能随时卸载——这三条守住才配得上"Claude Code 下载即用"的定位。

## Risks / Trade-offs

- **[风险] 首次 bootstrap 失败率** → 通过只读模式降级 + AskUserQuestion 的三档选项 + 清晰的错误诊断（doctor 返回结构化 stdout）缓解。不会阻断用户看已有内容。
- **[风险] A 路线的单向不可逆演化**（第一个带 bun 的 skill 出货后，后续所有 skill 都得带）→ 在 CLAUDE.md 显式记录这个架构约束，让未来的决策者不会基于旧定义做选择。proposal 已经 BREAKING 标注。
- **[风险] 信任面扩大**（skill 从纯文本包变成"第一次运行要下载第三方二进制"）→ 决策 10 的透明度措施 + 用户可以 opt-out 走档位 1 手动安装 + 只读模式兜底。可接受。
- **[风险] bun 版本漂移**（用户机器上已经装了旧版 bun）→ 装到私有目录 `$HOME/.soulkiller-runtime/` 而非共享 `$HOME/.bun`，彻底隔离。Doctor 只看私有目录下的 bun 版本。
- **[风险] Windows 用户被排除** → 显式决策，写在 SKILL.md 顶部的「平台范围」段落和 CLAUDE.md（项目无独立 README）。不装作兼容是最诚实的做法。
- **[风险] mini-yaml 解析器的边缘 case**（比如值里含冒号、引号、特殊字符）→ 由 `src/export/state/` 的单元测试覆盖。state.yaml 的值域本来就被 schema 类型系统限定（int/bool/enum/string），边缘 case 范围可控。
- **[风险] 脚本执行失败时的 LLM 回收路径**（脚本 crash 但 state.yaml 半更新）→ apply.ts 用 temp-file + rename 保证事务性，不会留下半更新状态。Crash 后下一次 doctor + validate 能检测到并触发修复菜单。
- **[风险] 错误类 F（LLM 跳过 apply）仍未解决** → 不在本次 scope 内。这是一个 prompt-layer 问题，需要另一次 change 来加 Phase -1 的"上次 session 审计"机制。本次明确承认这个边界。
- **[折中] 归档大小增加** → 新增的 `runtime/bin/*.sh` + `runtime/lib/*.ts` 总共不到 ~20KB 文本，相对于一个典型 skill（几百 KB 角色数据 + 世界数据）可忽略。
- **[折中] 旧 skill 归档一次性作废** → 接受。Soulkiller 目前处于快速迭代期，用户基数小，不值得维护兼容层。在 CHANGELOG / README 明示即可。

## Migration Plan

1. **Phase A（基建）**: 在 Soulkiller 源码里建立 `src/export/state/`，写 `mini-yaml.ts` + `schema.ts` + 六个子命令的 `.ts` 实现 + 完整的单元测试。这一阶段不修改 packager 和 skill-template，可以独立开发、测试、合并。
2. **Phase B（打包）**: 修改 `packager.ts`，把 `src/export/state/*.ts` 拷贝到归档的 `runtime/lib/`，注入 `runtime/bin/state` + `runtime/bin/doctor.sh`。更新 `expectedFileCount` / `expectedTextSizeKb` 让 Phase 1 的"上下文预算"排除 runtime 代码。在这一步可以导出测试 skill，手动 smoke test 整个 bootstrap → apply 流程。
3. **Phase C（SKILL.md 改写）**: 修改 `skill-template.ts`——Phase -1 Step 0 新增 doctor 段落；Phase 2 的 `apply_consequences 标准流程` 整段重写为"调用 `state apply`"；Phase -1 六重校验改写为"调用 `state validate`"；"从头再来" / "Phase 2 首次进入场景" 的 Write 指令删除。
4. **Phase D（文档 + 验证）**: 更新 CLAUDE.md 的 "Export / Skill format" 段落。运行 e2e 测试导出一个 skill，在干净环境下从零走一遍 bootstrap → init → apply → validate → reset 全路径。
5. **回滚策略**: 每个 Phase 的 commit 独立可回滚。Phase A/B/C 之间合并保守。Phase C 是 SKILL.md 破坏性改动，如果导出后发现问题可以 `git revert` 该 commit 并立即重导一版回退 skill。

## Open Questions → Resolutions

- **bun 最低版本**: ✅ 解决 — `doctor.sh` 设定为 `1.1.0` 作为 `MIN_BUN_MAJOR.MIN_BUN_MINOR.MIN_BUN_PATCH`，返回 `STATUS: BUN_OUTDATED` 时建议用户重跑 `UPGRADE_CMD_UNIX` 升级。
- **只读模式的具体 UX**: ✅ 解决 — Phase -1 的 `PLATFORM_UNSUPPORTED` / `PLATFORM_UNKNOWN` 分支明确列出"允许"动作（列已有 script / 查看 save / 查看结局图鉴）和"禁止"动作（init / apply / reset / rebuild / 进 Phase 1/2），与 `BUN_MISSING` 的"取消（进入只读模式）"选项共用同一套降级。
- **doctor.sh 的 POSIX 合规性测试**: 部分解决 — `package.json` 加入 `lint:shell` 脚本（`shellcheck --shell=sh` / `--shell=bash`），但本机未预装 shellcheck；已手动验证 doctor.sh 无 bash-isms 且 shebang 是 `#!/bin/sh`。CI 接入等 shellcheck 可用环境。
- **旧 skill 归档作废的用户告知方式**: ✅ 解决 — `CLAUDE.md` 的 "Export / Skill format" 段落和 proposal 的 BREAKING 标签共同记录。项目无独立 README。旧 skill 归档在 Phase -1 Step 0 运行时会因为找不到 `runtime/bin/state` 而由 Claude Code 的 Bash 工具自动报 command-not-found，用户会知道要重新 export。
- **`state validate` 的 JSON schema 格式**: ✅ 解决 — 实现为 `{ ok: boolean, errors: Array<{ code: string, message: string, field?: string, expected?: unknown, actual?: unknown }> }`。10 种 error code 定义见 `src/export/state/validate.ts`，`cloud-skill-format` spec 中的对照表和 SKILL.md 模板中的修复菜单对齐这个契约。
