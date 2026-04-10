## Why

Phase 2 当前的状态写入机制依赖 LLM 按 prompt 指令用 `Edit` 工具手动修改 `state.yaml` 和 `meta.yaml`。这个机制在 clamp 算错、漏 consequences key、类型写错、state/meta 不同步等机械性错误类上存在根治不了的漂移——这些错误是**静默失败**的，只能靠 Phase -1 加载时校验兜底。把受约束的状态转移这种纯机械工作从 LLM 手里拿走，交给可测试的代码执行，是把错误面从"LLM 服从性问题"降级为"一次性修掉的代码 bug"的唯一路径。

## What Changes

- **BREAKING**: Phase 1 生成的剧本文件从 `runtime/scripts/script-<id>.yaml` 改为 `runtime/scripts/script-<id>.json`。原因是 `runtime/lib/` 严禁 npm 依赖，bun stdlib 没有 runtime yaml parser，而 JSON.parse 是零依赖零维护的原生能力。`state.yaml` 和 `meta.yaml` 保留 yaml 格式（mini-yaml 解析）以保持存档的人类可读性。
- **BREAKING**: Skill 运行时新增 bun runtime 依赖。导出的 skill 归档内新增 `runtime/bin/`（bash wrapper + POSIX sh doctor）和 `runtime/lib/`（bun TypeScript 实现层）。首次运行需要 bootstrap 安装 bun 到用户私有目录 `$HOME/.soulkiller-runtime/`。
- **BREAKING**: `state.yaml` 和 `meta.yaml` 不再由 LLM 直接 `Edit` 或 `Write`。所有状态写入通过 `bash runtime/bin/state <subcommand>` 完成。LLM 只读不写。
- **BREAKING**: `SKILL.md` 的 Phase -1 新增 Step 0（doctor 健康检查 + 首次 bootstrap 引导），Phase 2 的 `apply_consequences` 段落重写为"调用 `state apply`"，Phase -1 六重校验改写为调用 `state validate`，"从头再来" 改用 `state reset`。
- **BREAKING**: A 路线定义收窄为"任意 **Unix-like**（macOS / Linux / Windows+WSL）Claude Code 用户下载即用"。Windows 原生 shell 显式不支持，doctor 检测到即拒绝。
- 新增 `state` 工具 API 契约（`doctor / init / apply / validate / rebuild / reset`），作为未来 skill 运行时的稳定入口。
- 新增 `src/export/state/` 作为作者侧和消费侧共享的代码源——packager 在打包时把 `*.ts` 原样拷贝进 skill 归档，作者侧单元测试即消费侧运行时测试。
- 新增首次运行时的信任事件：LLM 通过 AskUserQuestion 明示将执行 `curl -fsSL https://bun.sh/install | bash`，提供"我来帮你装 / 我自己装 / 取消"三档选项（档位 2：LLM 协助安装）。
- 错误类 B（clamp）/ C（漏 key）/ D（类型错）/ E（state-meta 不同步）由脚本根治；错误类 F（LLM 跳过调用）仍需 prompt 约束 + Phase -1 审计。
- 旧版 prompt 驱动的 skill 归档被一次性淘汰，不提供向后兼容开关。

## Capabilities

### New Capabilities
- `skill-runtime-state`: Skill 归档内 `runtime/bin/` + `runtime/lib/` 运行时工具集的结构、API 契约、bootstrap 流程和错误降级路径。定义 `state` wrapper + `doctor.sh` + 六个 bun 子命令的职责边界。

### Modified Capabilities
- `cloud-skill-format`: Skill 目录结构增加 `runtime/bin/` 和 `runtime/lib/` 两个子目录；SKILL.md 模板在 Phase -1 增加 Step 0（doctor 检查），Phase 2 `apply_consequences` 段落改写为调用 `state apply`，Phase -1 六重校验改写为调用 `state validate`，"从头再来" 和 "首次进入场景" 都改用脚本；A 路线的平台范围收窄为 Unix-like。
- `state-schema`: `state.yaml` 和 `meta.yaml` 的写入者从 LLM（Edit）变为脚本（fs）；"唯一允许 Write 整个 state.yaml 的两个时机" 条款删除，取而代之的是"state.yaml 永远由 `runtime/lib/*.ts` 写入"；LLM 的职责退化为"读取状态用于渲染"。

## Impact

- **源码新增**:
  - `src/export/state/mini-yaml.ts` — 扁平 yaml parser/serializer（零 npm 依赖）
  - `src/export/state/schema.ts` — `StateSchema` 类型 + `applyDelta` / `parseStateFile`
  - `src/export/state/script.ts` — `script.json` 加载器，内部用 `JSON.parse`
  - `src/export/state/io.ts` — 原子事务性 fs 写入（temp-file + rename）
  - `src/export/state/init.ts` / `apply.ts` / `validate.ts` / `rebuild.ts` / `reset.ts` — 六个子命令的纯函数实现
  - `src/export/state/main.ts` — CLI dispatcher（LLM 不可见）
  - `src/export/state/doctor.sh` — 纯 POSIX sh 平台 + bun 健康检查
  - `src/export/state/state.sh` — bash wrapper（打包为 `runtime/bin/state`，丢 `.sh` 后缀）
  - 单元测试 7 个：`tests/unit/export-state-{mini-yaml,schema,init,apply,validate,reset-rebuild,main}.test.ts` + `tests/unit/helpers/state-fixture.ts`
  - `tests/unit/export-packager-runtime.test.ts` — injectRuntimeFiles + budget exclusion
- **源码修改**:
  - `src/export/packager.ts` — 新增 `injectRuntimeFiles()` 把 `src/export/state/*` 拷贝进归档；`archiveFiles` 支持 fflate `ZipOptions` 元组以保留 runtime/bin/* 的 0755 位；`countMdFilesInMap` / `estimateMdTextSizeKb` 显式排除 `runtime/`
  - `src/export/skill-template.ts` — 新增 `buildPlatformNotice()`；frontmatter `allowed-tools += Bash`；`buildPhaseMinusOne()` 整段重写（Step 0 doctor + state validate JSON 诊断 + 修复菜单改为 state rebuild/reset）；`buildSaveSystemSection()` 改为 state apply；multi / single char engine 的 Phase 1（script.yaml → script.json 示例改写）+ Phase 2（apply_consequences 改为 state apply 调用）+ 重玩规则（改为 state reset）+ 禁止事项新增「状态文件直写（硬红线）」；`buildStateSchemaSection()` 的 yaml 示例改为 JSON
  - `src/export/lint/lint-skill-template.ts` — 新增 `lintRuntimeCliUsage()` 实现 `PHASE_0_DOCTOR_PRESENT` / `STATE_APPLY_PRESENT` / `NO_EDIT_STATE_YAML` 三条规则；`lintStorySpec` 重构为不跑 runtime CLI 规则（story-spec.md 不需要）
  - `package.json` — 新增 `lint:shell` 脚本（shellcheck 双模式）
- **测试更新**:
  - `tests/unit/export-tools.test.ts` — `allowed-tools` 断言 + `Bash`；新增 11 条 runtime 结构断言（runtime/bin/state、doctor.sh、runtime/lib/*.ts 存在 + shebang 校验）
  - `tests/unit/export.test.ts` — 7 个旧模板字符串断言重写以适配新模板（yaml → json 路径、Edit → state apply、六重校验 prose → JSON error code 对照）
  - `tests/unit/export-lint.test.ts` — 2 个 clean-case 断言修订为 rule-filtered；新增 11 个 runtime CLI 规则测试
- **文档**: `CLAUDE.md` 的 "Architecture / Export / Skill format" 段落更新——`src/export/state/` 描述、skill-runtime-bun-state change 说明、bun runtime 依赖声明、A 路线平台范围修订、错误类责任分界；"Testing" 段落增补 skill runtime state tests 分布
- **不受影响**: `story-spec.md` / `characters/` / `world/` / `runtime/scripts/` 目录位置完全不变（内容格式 yaml → json 仅限 script）；Phase 1 的 state_schema 创作约束不变；endings DSL 不变；已存在的 distill / export-agent / prose-style-anchor 系统不变；i18n locale 文件不变（无相关字符串）
- **用户首次运行**: 新增一次性 bootstrap 步骤（~90MB 下载），Windows 原生用户被要求切换到 WSL
