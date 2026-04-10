# skill-runtime-state Specification

## Purpose
TBD - created by archiving change skill-runtime-bun-state. Update Purpose after archive.
## Requirements
### Requirement: runtime/bin 和 runtime/lib 目录布局
Skill 归档 SHALL 在 `runtime/` 下包含两个平级子目录：`runtime/bin/` 和 `runtime/lib/`。`runtime/bin/` 是 LLM 面向的 API 面，只放 `state` bash wrapper 和 `doctor.sh` 两个文件。`runtime/lib/` 是实现层，存放 bun 执行的 TypeScript 源码，LLM 不直接调用 `runtime/lib/` 下的任何文件。

#### Scenario: runtime/bin 内容
- **WHEN** skill 归档被解压
- **THEN** `runtime/bin/` SHALL 包含恰好两个文件：`state` 和 `doctor.sh`
- **AND** `state` SHALL 是 bash 脚本
- **AND** `doctor.sh` SHALL 是纯 POSIX sh 脚本（不依赖 bash-isms）

#### Scenario: runtime/lib 内容
- **WHEN** skill 归档被解压
- **THEN** `runtime/lib/` SHALL 包含至少以下文件：`main.ts` / `apply.ts` / `init.ts` / `validate.ts` / `rebuild.ts` / `reset.ts` / `schema.ts` / `mini-yaml.ts`
- **AND** 所有 `.ts` 文件 SHALL 只引用 bun stdlib，不引用任何 npm 包
- **AND** 归档内 SHALL NOT 包含 `node_modules/` 或 `package.json`（消费侧运行时无需 `bun install`）

### Requirement: state CLI 工具八子命令契约
state CLI 提供 **八** 个子命令：`doctor`、`init`、`apply`、`validate`、`rebuild`、`reset`、`save`、`list`。

- `doctor` — 运行时健康检查（不变）
- `init <script-id>` — 初始化剧本的 auto/ 存档槽（从 script.json 的 initial_state 写入）
- `apply <script-id> <scene-id> <choice-id>` — 应用选择后果到 auto/ 存档
- `validate <script-id> [<save-type>] [--continue]` — JSON 诊断，save-type 为 `auto`（默认）或 `manual:<timestamp>`
- `rebuild <script-id> [<save-type>]` — 修复指定存档的 state.yaml
- `reset <script-id> [<save-type>]` — 重置指定存档到 initial_state
- `save <script-id> [--overwrite <timestamp>]` — 将 auto/ 快照到 manual/<timestamp>/；`--overwrite` 先删旧再建新
- `list <script-id>` — JSON 输出该剧本的所有存档概要

不提供 `get` 或 `set` 子命令（不变）。

#### Scenario: init 创建 per-script auto 存档
- **WHEN** `state init a3f9c2e1` 被调用
- **THEN** 系统 SHALL 在 `runtime/saves/a3f9c2e1/auto/` 创建 state.yaml 和 meta.yaml

#### Scenario: apply 写入 auto 存档
- **WHEN** `state apply a3f9c2e1 scene-5 choice-2` 被调用
- **THEN** 系统 SHALL 更新 `runtime/saves/a3f9c2e1/auto/state.yaml` 和 `auto/meta.yaml`

#### Scenario: validate 支持 save-type 参数
- **WHEN** `state validate a3f9c2e1 manual:1712345678 --continue` 被调用
- **THEN** 系统 SHALL 对 `runtime/saves/a3f9c2e1/manual/1712345678/` 执行诊断

#### Scenario: save 创建手动快照
- **WHEN** `state save a3f9c2e1` 被调用且手动存档 < 3
- **THEN** 系统 SHALL 复制 auto/ 内容到 `manual/<unix-timestamp>/`

#### Scenario: save 覆盖指定存档
- **WHEN** `state save a3f9c2e1 --overwrite 1712345678` 被调用
- **THEN** 系统 SHALL 删除 `manual/1712345678/` 并创建新的 `manual/<new-timestamp>/`

#### Scenario: list 输出 JSON
- **WHEN** `state list a3f9c2e1` 被调用
- **THEN** 系统 SHALL 输出 JSON 包含 auto + manual 存档概要

#### Scenario: 未知子命令拒绝
- **WHEN** LLM 执行 `bash runtime/bin/state set "affinity.judy.trust" 10`
- **THEN** `state` SHALL 以非零退出码失败
- **AND** stderr SHALL 明示"set 不是合法子命令，所有写入必须通过 init/apply/reset/rebuild"

### Requirement: state apply 从 script 自读 consequences
`state apply <slot> <scene-id> <choice-id>` SHALL 从 `runtime/scripts/script-<id>.json` 中定位 `scenes[scene-id].choices[choice-id].consequences`，自行执行 delta 计算、clamp、enum 校验，而不是从命令行参数接收 patch。LLM **不参与** consequences 的计算或构造。

#### Scenario: script 文件是 JSON
- **WHEN** Phase 1 LLM 生成剧本
- **THEN** 文件路径 SHALL 是 `runtime/scripts/script-<id>.json`
- **AND** 文件内容 SHALL 通过 `JSON.parse` 解析
- **AND** SHALL NOT 使用 yaml 扩展名或 yaml 语法

#### Scenario: consequences 从 script 读取
- **WHEN** LLM 执行 `bash runtime/bin/state apply slot-1 scene-005 choice-2`
- **AND** `script-<id>.json` 中 `scenes["scene-005"].choices[2].consequences` 含 `"affinity.judy.trust": 2` 和 `"flags.met_johnny": true`
- **THEN** `state apply` SHALL 把 trust 加 2（带 clamp）并把 met_johnny 覆盖为 true
- **AND** 命令行参数中 SHALL NOT 出现任何 key/value pair

#### Scenario: 未知 scene / choice
- **WHEN** LLM 传入一个 scene.yaml 里不存在的 choice id
- **THEN** `state apply` SHALL 以非零退出码失败
- **AND** stderr SHALL 明示 "scene X has no choice Y"

### Requirement: 状态更新的事务性
`state apply` / `state init` / `state reset` / `state rebuild` SHALL 以事务性方式同时写入 `state.yaml` 和 `meta.yaml`——要么两个文件都更新成功，要么两个文件都不变。实现方式 SHALL 使用 temp-file + `rename` 的原子替换语义。脚本 crash 后 SHALL NOT 留下半更新状态。

#### Scenario: state 和 meta 同步更新
- **WHEN** `state apply` 同时需要改 state.yaml 的某字段和 meta.yaml 的 current_scene
- **THEN** 脚本 SHALL 先在临时文件中写入两份新内容
- **AND** 再用 fs.rename 原子替换两个目标文件

#### Scenario: crash 不留半状态
- **WHEN** 脚本在写 state.yaml 成功后但 meta.yaml 写入前 crash
- **THEN** 临时文件 SHALL 未被 rename
- **AND** state.yaml 和 meta.yaml SHALL 保持 crash 前的旧内容

### Requirement: doctor.sh 纯 POSIX sh 零依赖
`runtime/bin/doctor.sh` SHALL 是纯 POSIX shell 脚本，不使用 bash-isms（不得使用 `[[ ]]`, `${var,,}`, `declare -A` 等）。SHALL 不依赖 `jq` / `yq` / `curl` 之外的外部工具（`curl` 只在首次 bootstrap 路径里按需使用）。脚本通过 `shellcheck --shell=sh` 的静态检查。

#### Scenario: 纯 POSIX 语法
- **WHEN** 对 `doctor.sh` 运行 `shellcheck --shell=sh`
- **THEN** shellcheck SHALL 返回 0 个 error
- **AND** shebang SHALL 是 `#!/bin/sh` 而非 `#!/bin/bash`

### Requirement: doctor 平台检测与 Windows 拒绝
`doctor.sh` SHALL 检测运行平台：

- macOS / Linux / WSL：接受，继续检查 bun
- Windows 原生（MINGW / MSYS / CYGWIN / Git Bash）：拒绝并返回结构化错误 `STATUS: PLATFORM_UNSUPPORTED`，引导用户切换到 WSL
- 其他未知平台：拒绝并返回 `STATUS: PLATFORM_UNKNOWN`

#### Scenario: macOS 接受
- **WHEN** `doctor.sh` 在 macOS 上运行
- **THEN** 退出码为 0 或继续进入 bun 检查路径

#### Scenario: Windows Git Bash 拒绝
- **WHEN** `doctor.sh` 在 Windows Git Bash 下运行（`$OSTYPE` 含 `msys` 或 `uname -s` 含 `MINGW`）
- **THEN** 退出码 SHALL 非零
- **AND** stdout SHALL 含 `STATUS: PLATFORM_UNSUPPORTED`
- **AND** 输出 SHALL 引导用户切换到 WSL

### Requirement: doctor 结构化输出契约
`doctor.sh` SHALL 输出结构化的 stdout，每行格式 `KEY: value`，让 LLM 可以用 Read / 文本匹配解析。状态字段 `STATUS` SHALL 是以下枚举之一：`OK` / `BUN_MISSING` / `BUN_OUTDATED` / `PLATFORM_UNSUPPORTED` / `PLATFORM_UNKNOWN`。

#### Scenario: BUN_MISSING 结构
- **WHEN** bun 未安装
- **THEN** stdout SHALL 至少包含：
  - `STATUS: BUN_MISSING`
  - `PLATFORM: darwin-arm64`（或对应平台）
  - `INSTALL_CMD_UNIX: curl -fsSL https://bun.sh/install | BUN_INSTALL=$HOME/.soulkiller-runtime bash`
  - `BUN_DOCS: https://bun.sh/docs/installation`
  - `INSTALL_DIR: $HOME/.soulkiller-runtime`

#### Scenario: OK 结构
- **WHEN** bun 已安装且版本满足最低要求
- **THEN** stdout SHALL 至少包含：
  - `STATUS: OK`
  - `BUN_VERSION: 1.x.y`
  - `BUN_PATH: /path/to/bun`

### Requirement: bun 私有目录安装
首次 bootstrap SHALL 把 bun 安装到 `$HOME/.soulkiller-runtime/`，而 **不是** `$HOME/.bun`。SHALL 通过设置 `BUN_INSTALL=$HOME/.soulkiller-runtime` 环境变量传递给 bun 官方 installer。SHALL NOT 修改用户的 `.zshrc` / `.bashrc` / `.profile`。

#### Scenario: 不污染 PATH
- **WHEN** 用户接受首次 bootstrap
- **THEN** `state` wrapper SHALL 通过绝对路径 `$HOME/.soulkiller-runtime/bin/bun` 调用 bun
- **AND** 用户的 shell rc 文件 SHALL 不被修改
- **AND** 用户重启 shell 后 PATH 中 SHALL 不出现新的 bun

#### Scenario: 不与系统 bun 冲突
- **WHEN** 用户已经在 `/usr/local/bin/bun` 装了其他版本的 bun
- **THEN** `state` wrapper SHALL 仍使用 `$HOME/.soulkiller-runtime/bin/bun`
- **AND** 不受系统 bun 版本影响

### Requirement: state wrapper 对 LLM 屏蔽 bun
`runtime/bin/state` bash wrapper SHALL 把 bun 运行时完全屏蔽在实现细节层。LLM prompt 中 SHALL NOT 出现 `bun` 字眼。wrapper 的职责是：

1. 检查 `$HOME/.soulkiller-runtime/bin/bun` 是否存在
2. 若不存在，触发 doctor 流程
3. 若存在，`exec` 到 `bun runtime/lib/main.ts "$@"`

#### Scenario: wrapper 不暴露 bun
- **WHEN** LLM 读 SKILL.md
- **THEN** Phase 2 的 apply_consequences 段落 SHALL 只出现 `bash runtime/bin/state apply ...` 形态
- **AND** SHALL NOT 出现 `bun runtime/lib/apply.ts ...` 形态

### Requirement: bootstrap 信任事件透明度
首次需要安装 bun 时，SKILL.md SHALL 指示 LLM 通过 AskUserQuestion 向用户展示安装决策界面。question body SHALL 包含：

1. 完整的 curl 命令（不折叠、不缩写）
2. bun 官方主页链接 `https://bun.sh`
3. 安装目录 `$HOME/.soulkiller-runtime/`
4. 下载大小预估 `~90MB`
5. 卸载说明：`你可以随时删除该目录以完全卸载`

question 的选项 SHALL 至少包含三档：

- "我来帮你装"——LLM 调用 `Bash` 执行安装命令
- "我自己装，告诉我命令"——展示命令，等用户外部执行后重跑 doctor
- "取消"——进入只读模式或退出

#### Scenario: AskUserQuestion 含完整 curl 命令
- **WHEN** doctor 返回 `STATUS: BUN_MISSING`
- **THEN** LLM 构造的 AskUserQuestion question body SHALL 逐字包含 curl 命令
- **AND** SHALL 包含 `https://bun.sh` 链接
- **AND** SHALL 包含安装目录路径
- **AND** SHALL 提供至少 3 个选项

### Requirement: bootstrap 失败降级到只读模式
若 bootstrap 失败（用户取消 / 网络不通 / 平台不支持），Phase -1 SHALL 进入"只读模式"：

- 允许：列出已有 script、用 Read 查看已存在的 save 状态、查看结局图鉴（Phase 3）
- 禁止：`state init` / `state apply` / `state reset` / `state rebuild`（任何写入）
- 禁止：进入 Phase 1（新建剧本需要 state init）
- 禁止：进入 Phase 2（场景流转需要 state apply）

#### Scenario: 只读模式禁止新建
- **WHEN** bootstrap 失败，用户在 Phase -1 试图选"生成新剧本"
- **THEN** SKILL.md 指示 LLM 告知"只读模式下无法新建剧本，请先完成 runtime 安装"
- **AND** 提供重试 bootstrap 入口

#### Scenario: 只读模式允许查看旧存档
- **WHEN** bootstrap 失败，已存在合法存档
- **THEN** 用户 SHALL 能通过 Read 工具查看 `runtime/saves/slot-<N>/state.yaml` 的内容
- **AND** 能看到已有的结局图鉴

### Requirement: 共享 TypeScript 源码路径
`src/export/state/` 目录中的源文件被 packager 原封不动复制到 `runtime/lib/`，并由 vitest 测试覆盖。新增的 `save.ts` 和 `list.ts` 模块 SHALL 遵循相同模式：零 npm 依赖，仅使用 bun stdlib + inline mini-yaml parser。

#### Scenario: 新模块被 packager 复制
- **WHEN** packager 构建 skill 归档
- **THEN** `src/export/state/save.ts` 和 `src/export/state/list.ts` SHALL 被复制到 `runtime/lib/save.ts` 和 `runtime/lib/list.ts`

#### Scenario: 新模块有测试覆盖
- **WHEN** `bun run test` 执行
- **THEN** `save.ts` 和 `list.ts` 的逻辑 SHALL 被 vitest 测试覆盖

### Requirement: mini-yaml 零依赖扁平解析器
`runtime/lib/mini-yaml.ts` SHALL 提供一个只支持扁平 `"<quoted-key>": <value>` 结构的 yaml 解析器。SHALL NOT 支持嵌套、block scalar、multi-line、anchors、tags 等高级 yaml 特性。SHALL NOT 依赖任何 npm 包（如 `js-yaml`）。

支持的值类型：`int`（如 `3`）/ `bool`（`true`/`false`）/ `string`（如 `bar` 或 `"bar"`）。

#### Scenario: 扁平解析
- **WHEN** parse `  "affinity.judy.trust": 5\n  "flags.met_johnny": true\n  "custom.location": bar`
- **THEN** 返回 `{ "affinity.judy.trust": 5, "flags.met_johnny": true, "custom.location": "bar" }`

#### Scenario: 拒绝嵌套
- **WHEN** parse `affinity:\n  judy:\n    trust: 5`
- **THEN** 抛出 `MiniYamlError: nested structure not supported`

#### Scenario: 无 npm 依赖
- **WHEN** 检查 `runtime/lib/mini-yaml.ts` 的 import 语句
- **THEN** 只能出现 bun 内置模块（如 `fs`）或相对路径 import



