## Context

`.skill` 归档的 Phase -1 流程早期用 `runtime doctor` 做两件事：
1. 判断 `soulkiller` 是否安装（否则后续所有 `soulkiller runtime <xxx>` 都会失败）
2. 报告 `BUN_VERSION` / `SOULKILLER_VERSION` 等调试信息

随着 binary 改为 `bun build --compile` 嵌入 bun，(2) 失去意义——能执行 doctor 子命令 ⇔ bun 能用。(1) 则退化为"空跑即 OK"——LLM 从 doctor 的 stdout 看到 `STATUS: OK` 就继续，看到 shell 返回 `command not found` 就跳安装分支。

真实的信号只有 shell 层的 `command not found`。换言之，Phase -1 Step 0 的体检步骤是冗余的——Step -1.1 第一条 `soulkiller runtime scripts` 调用同样会暴露这个信号。

另外若希望在 skill 归档解压错误（如之前 zip 多嵌套一层）或 runtime/lib 污损时给出明确诊断，这类检查更适合由用户主动运行的 `soulkiller doctor <path>` 顶层命令承载——不应该塞进 LLM 引导流程。

## Goals / Non-Goals

**Goals:**
- 从 SKILL.md 模板删除 Phase -1 Step 0 的独立体检步骤；安装检测改由首条 runtime 调用的 command-not-found 事件代替
- 新增 `soulkiller doctor [path]` 顶层命令作为"深度体检"入口
- `runtime doctor` 保留 no-op + deprecation 通道，保证已分发的老 skill 首次加载不挂
- 相应 lint 规则从 `PHASE_0_DOCTOR_PRESENT` 迁移为 `PHASE_MINUS_ONE_INSTALL_GUIDE_PRESENT`

**Non-Goals:**
- 不修改 state CLI 其他子命令（init/apply/reset/...）
- 不改变 `.skill` 归档的目录结构或打包规则
- 不为老 skill 做回溯升级；deprecation 信息仅作为提示，不强制用户重装

## Decisions

### 决策 1：安装检测入口

**选择**：删除 Phase -1 Step 0 独立体检，改用首条 `soulkiller runtime <xxx>` 命令的 command-not-found 信号。

**替代方案**：
- 保留 Step 0 但精简输出（只留 `STATUS: OK` + `SOULKILLER_VERSION`）—— 仍然多一次 LLM round-trip，省不了多少 token
- 直接去掉 doctor 子命令 —— 老 skill 会第一步就挂，破坏兼容性

**理由**：
- Shell 层的 command-not-found 是权威信号，无需额外 stdout 解析
- SKILL.md 少一段 Step 0 指令，Phase -1 提示词更短
- LLM 首次看到 `sh: soulkiller: command not found` 会自然进入安装提示分支——这个行为约定需要在 SKILL.md 的"错误兜底"里明文化

### 决策 2：`runtime doctor` no-op 保留

**选择**：保留 `runtime doctor` 子命令，stdout 输出 `STATUS: OK` + `DEPRECATED: use 'soulkiller doctor' instead`，stderr 也打印一行 deprecation notice。

**替代方案**：
- 彻底删除 → 老 skill 首次加载即中断
- 直接移除 doctor 分支但 exit 0 保留兼容 → 老 skill 的 LLM parser 看不到 `STATUS: OK` 可能走异常分支

**理由**：
- 老 skill 归档已在用户机器上分发，兼容成本几乎为零（几行代码）
- Deprecation 信息落在 stderr，不污染 stdout 的 `KEY: value` 协议
- 未来 1–2 个大版本后可再评估是否彻底清除

### 决策 3：`soulkiller doctor` 顶层命令位置

**选择**：作为 binary 顶层子命令实现，不是 REPL 的 slash command。即用户运行 `soulkiller doctor [path]`，而非在 REPL 里 `/doctor`。

**替代方案**：
- slash command `/doctor` → 用户还得先进 REPL，排障场景反而累赘（REPL 启动本身可能因配置缺失失败）
- 同时提供两种入口 → 维护两份实现

**理由**：
- 排障场景天然在 shell 里，binary 级命令无需加载 REPL 依赖
- 与 `--version` / `--update` 同级，保持 CLI 表面一致

**实现位置**：`src/cli/doctor.ts` 作为独立模块；`src/index.tsx` 在命令行解析阶段识别 `doctor` 子命令并 dispatch，避免 ink 渲染。

### 决策 4：`soulkiller doctor [path]` 输出协议

**选择**：沿用 `KEY: value` 单行格式，便于脚本化解析：

```
STATUS: OK
SOULKILLER_VERSION: 0.3.6
BUN_VERSION: 1.3.11
PLATFORM: darwin-arm64
```

带 path 时追加：

```
SKILL_PATH: /path/to/skill
SKILL_MD: OK
RUNTIME_LIB_MAIN: OK
RUNTIME_LIB_FILES: 12/12
RUNTIME_SCRIPTS_DIR: OK (3 scripts)
```

检测到问题时 `STATUS: FAIL` + 对应字段明细（`SKILL_MD: MISSING` 等）并 exit 1。

**理由**：
- 与现有 `runtime doctor` 协议一致，便于后续 LLM 侧接入（如 Claude 可在排障时自动跑 `soulkiller doctor`）
- 单行 key/value 易于被 CI、脚本消费

### 决策 6：已分发 skill 与示例库升级

**选择**：通过既有的 `soulkiller skill upgrade` 命令 + `engine_version` 比对驱动模板升级；示例库由维护者在合入后重新生成并 commit。

**分发链路**：
1. 内嵌 `engine_version` 在 binary 编译时写死（如 `0.4.0`）。模板变更触发版本号 bump。
2. 用户机器上的 skill（`~/.claude/skills/<name>/soulkiller.json`）记录了 skill 安装时的 `engine_version`。
3. 用户执行 `soulkiller skill upgrade [--all]` 时：
   - 对比两个版本号；低于内嵌版本即覆盖更新 `runtime/engine.md`
   - SKILL.md 本身是 story 内容 + 引导文本，`runtime/engine.md` 承载 Phase 流程指令（Phase -1 / Phase 1 / Phase 2 / Phase 3 的章节模板）
   - 因此本次 Phase -1 Step 0 的删除体现在 `runtime/engine.md` 的新内容里，SKILL.md 不需要重写
4. 示例库 `examples/skills/*.skill` 由维护者在本 change 合入后：
   - 本地运行 soulkiller，用最新模板 `/export` 重新生成三款 skill
   - 覆盖 `examples/skills/fate-zero.skill` / `three-kingdoms.skill` / `white-album-2.skill`
   - commit 到 main，下次 tag push 时 CI 自动推到 R2
5. 已从 R2 直接下载 skill 的用户：README 一键脚本已内置 `rm -rf` 覆盖，再跑一次即为最新

**替代方案**：
- 让每次 skill 启动时自动检查 + 热更 `runtime/engine.md` → 引入额外网络/IO，破坏离线可用性
- 强制用户删除旧 skill 重装 → UX 差且丢失存档
- 内嵌一个自动迁移补丁脚本到老 skill 里 → 老 skill 已分发，无法追溯

**理由**：
- `skill upgrade` 是已规划好的原生路径，本次变更属于它的标准工作面
- `runtime/engine.md` 与 SKILL.md 分离的设计恰好服务于这种情境：engine 可升级，story 内容不动，存档不丢
- 示例库重新生成是一次性维护动作，成本有限

### 决策 5：lint 规则迁移

**选择**：移除 `PHASE_0_DOCTOR_PRESENT`，新增 `PHASE_MINUS_ONE_INSTALL_GUIDE_PRESENT`。

该规则检查 SKILL.md 中 Phase -1 下是否存在：
- 字面量 `soulkiller runtime scripts`（或 `soulkiller runtime list`）作为首条命令
- 字面量 `command not found` 作为分支条件
- AskUserQuestion 安装引导块

**理由**：
- 确保模板迁移后 LLM 仍拿到完整的错误兜底逻辑
- 保持作者侧 lint 的 coverage，避免回退

## Risks / Trade-offs

| 风险 | 缓解 |
|------|------|
| 老 skill 首次加载调用 `runtime doctor` 仍期望完整输出 | 保留 no-op 分支输出 `STATUS: OK`，stdout 协议不变；只在 stderr 打 deprecation |
| LLM 误把 command-not-found 理解为"跑哪个命令都会失败"而跳过用户允许的 read-only 降级 | SKILL.md 模板在 Phase -1 开头保留 read-only 降级分支；lint 规则 `PHASE_MINUS_ONE_INSTALL_GUIDE_PRESENT` 强制覆盖 |
| `soulkiller doctor <path>` 误把普通目录当 skill 检查 | path 下找不到 `SKILL.md` 时直接输出 `SKILL_MD: MISSING` + `STATUS: FAIL` exit 1，不做启发式猜测 |
| deprecated runtime doctor 长期堆积 | 在 proposal 里记录：下下次 major 版本清理 |
| 用户未跑 `skill upgrade` → 旧模板的 skill 仍执行 Phase -1 Step 0 | `runtime doctor` no-op 兼容层保证继续可用；升级仅为"建议"而非"必需" |
| 示例库更新滞后于二进制 release | 本 change 的 tasks 把"重新生成 examples + commit"列为合入前的必做项；release.yml 会一起推到 R2 |

## Migration Plan

1. 合入后先发补丁版本（e.g. v0.3.7），runtime doctor 保留 no-op + deprecation
2. 下一个版本的 `.skill` 导出会使用新 SKILL.md 模板（不含 Step 0）
3. 用户重新导出的 skill 自动受益；老 skill 继续可用
4. 2 个 minor 版本后评估彻底删除 `runtime doctor` 分支

**Rollback**：如发现 command-not-found 信号不可靠（例如某些 shell 把 stderr 吞了），revert proposal 内的 SKILL.md 改动并临时恢复 Step 0；`soulkiller doctor` 顶层命令本身可独立保留。
