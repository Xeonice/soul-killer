## MODIFIED Requirements

### Requirement: SKILL.md frontmatter 含 Edit 工具
SKILL.md frontmatter 的 `allowed-tools` 字段 SHALL 包含 `Bash`，作为调用 `runtime/bin/state` wrapper 的执行工具。完整 allowed-tools 列表 SHALL 是 `AskUserQuestion Read Write Glob Edit Bash`，使用 Anthropic spec 要求的**空格分隔格式**（不是逗号分隔）。

`Edit` 和 `Write` 保留在 allowed-tools 中，用于 script.yaml 的生成（Phase 1）和非 state 文件的编辑，但 SHALL NOT 被用于修改 `state.yaml` 或 `meta.yaml`。

#### Scenario: frontmatter Bash 工具声明
- **WHEN** 生成 SKILL.md
- **THEN** frontmatter `allowed-tools` SHALL 包含 `Bash`
- **AND** 同时包含 `AskUserQuestion`、`Read`、`Write`、`Glob`、`Edit`
- **AND** 多个工具之间 SHALL 用单个空格分隔，**不使用逗号**

#### Scenario: Bash 工具用途限定
- **WHEN** SKILL.md 的 Phase 2 章节描述 state 更新
- **THEN** SHALL 指示 LLM 只通过 `bash runtime/bin/state <subcommand>` 修改 state/meta
- **AND** SHALL 明确禁止用 Edit 或 Write 直接修改 state.yaml 和 meta.yaml

### Requirement: Phase 2 场景流转用 Edit + 标准伪代码
SKILL.md Phase 2「场景流转规则」章节 SHALL 指示 LLM 通过 `bash runtime/bin/state apply <slot> <scene-id> <choice-id>` 完成 consequences 应用，**不再**手动执行 delta 计算或 Edit 操作。LLM 的职责限定为：

1. 接收用户的选择（choice id）
2. 调用 `state apply` 命令
3. 读取命令的 stdout（结构化变更摘要）用于渲染下一场景的过渡叙述
4. 渲染下一场景

consequences 的 delta 计算、clamp、enum 校验、state.yaml + meta.yaml 的写入 SHALL 全部由 `state apply` 脚本内部完成，LLM SHALL NOT 参与。

#### Scenario: Phase 2 段落命令形态
- **WHEN** 生成 SKILL.md
- **THEN** Phase 2 章节 SHALL 含至少一个 `bash runtime/bin/state apply` 的完整示例
- **AND** SHALL NOT 含"Edit state.yaml"形态的指令

#### Scenario: LLM 不算 delta
- **WHEN** Phase 2 章节描述状态转移
- **THEN** SHALL 明示 "LLM 不再计算 consequences delta，全部由脚本完成"
- **AND** SHALL NOT 含"查 state_schema[key] 拿 type → 按 type 计算新值"这类伪代码

#### Scenario: 禁止 Edit/Write state.yaml
- **WHEN** Phase 2 章节描述状态更新
- **THEN** SHALL 明确指示"不要用 Edit 或 Write 直接修改 state.yaml 或 meta.yaml"
- **AND** SHALL 说明"所有状态写入必须通过 state init/apply/reset/rebuild"

### Requirement: Phase -1 四重加载验证
SKILL.md Phase -1 章节 SHALL 通过调用 `bash runtime/bin/state validate <slot>` 执行加载时验证。脚本返回 JSON 诊断，LLM 根据诊断进入修复菜单或继续加载。

`state validate` 内部实现六重校验（沿用原有语义）：

1. **dangling reference 检查**：meta.yaml.script_ref 指向的 script 文件必须存在
2. **state_schema 完整性**：script.yaml 顶部必须含 state_schema 块
3. **initial_state 字段集对齐**：initial_state 字段集必须 == state_schema 字段集
4. **scenes consequences 抽样**：抽样 5 个 scene，每个 consequences key 必须存在于 state_schema
5. **共享 axes 完整性**：每个角色必须有完整的 3 个共享 axes（bond + story_state.shared_axes_custom 中的 2 个）
6. **flags 集合一致性**：script.state_schema 中所有 `flags.<name>` 字段的 name 集合必须严格等于 story_spec.flags 的 name 列表

「继续游戏」额外验证：

7. **state.yaml 字段集对齐**：state.yaml 字段集必须 == state_schema 字段集；不对齐 → LLM 弹「修复菜单」

`state validate` SHALL NOT 自动修复——它只返回诊断 JSON。修复动作由 LLM 通过 AskUserQuestion 驱动，可选动作可能调用 `state rebuild` 或 `state reset`。

#### Scenario: 验证调用形态
- **WHEN** Phase -1 加载存档
- **THEN** SKILL.md 指示 LLM 执行 `bash runtime/bin/state validate <slot>`
- **AND** 读取命令 stdout 解析 JSON
- **AND** 根据 `errors` 数组决定下一步

#### Scenario: dangling 检查
- **WHEN** Phase -1 选择某个存档
- **AND** 该存档的 meta.yaml.script_ref 指向的 script 文件不存在
- **THEN** `state validate` stdout 返回 `errors` 含 `code: DANGLING_SCRIPT_REF`
- **AND** SKILL.md 指示 LLM 标该存档为 (孤儿)，提供"删除存档"入口

#### Scenario: legacy hard fail
- **WHEN** 用户选择某个 script
- **AND** 该 script.yaml 顶部没有 state_schema 块
- **THEN** `state validate` 返回 `errors` 含 `code: STATE_SCHEMA_MISSING`
- **AND** SKILL.md 指示 LLM 标该 script 为 (legacy 不可重玩)

#### Scenario: 共享 axes 不完整
- **WHEN** 加载某 script，story_state.shared_axes_custom = ["trust", "rivalry"]
- **AND** 某角色的 state_schema 只含 `affinity.<char>.bond` 和 `affinity.<char>.trust`（缺 rivalry）
- **THEN** `state validate` 返回 `code: SHARED_AXES_INCOMPLETE`
- **AND** SKILL.md 指示 LLM 标 (损坏)

#### Scenario: Flags 集合不匹配
- **WHEN** script.state_schema 含 `flags.some_random_flag` 但 story_spec.flags 中没有该 name
- **THEN** `state validate` 返回 `code: FLAGS_SET_MISMATCH`

#### Scenario: 继续游戏 state 字段集修复菜单
- **WHEN** 「继续游戏」时 state.yaml 缺一个 schema 字段
- **THEN** `state validate` 返回 `code: FIELD_MISSING`
- **AND** SKILL.md 指示 LLM 弹出修复菜单
- **AND** 选项包含「补缺失字段为 default（调用 state rebuild）」「完全重置（调用 state reset）」「取消加载」

### Requirement: 重玩规则使用 Write 重置
SKILL.md「重玩当前剧本」流程 SHALL 使用 `bash runtime/bin/state reset <slot>` 把存档重置到 `initial_state`。LLM SHALL NOT 使用 `Write` 工具直接覆盖 state.yaml 或 meta.yaml。

#### Scenario: 重玩 → state reset
- **WHEN** 用户在 Phase -1 菜单选「重玩某剧本」
- **THEN** SKILL.md 指示 LLM 执行 `bash runtime/bin/state reset <slot>`
- **AND** 脚本内部从 script.initial_state 一次性重建 state.yaml
- **AND** 脚本内部把 meta.yaml.current_scene 重置为 scenes[0].id
- **AND** 进入 Phase 2 第一个场景

## ADDED Requirements

### Requirement: Phase -1 Step 0 doctor 健康检查
SKILL.md Phase -1 章节 SHALL 在所有其他 Phase -1 逻辑之前插入 **Step 0：Runtime 健康检查**。这一步通过 `bash runtime/bin/state doctor` 调用 doctor.sh，根据返回的结构化 stdout 决定后续流程。

可能的分支：

- `STATUS: OK` → 继续正常 Phase -1 流程
- `STATUS: BUN_MISSING` → 触发首次 bootstrap 引导（AskUserQuestion 三档选项）
- `STATUS: BUN_OUTDATED` → 提示用户升级 bun，继续 bootstrap 引导
- `STATUS: PLATFORM_UNSUPPORTED` → 告知用户切换到 WSL，进入只读模式或退出
- `STATUS: PLATFORM_UNKNOWN` → 进入只读模式

#### Scenario: Step 0 存在
- **WHEN** 生成 SKILL.md
- **THEN** Phase -1 章节 SHALL 在任何存档列表 / 新建剧本逻辑之前包含 Step 0
- **AND** Step 0 SHALL 指示 LLM 调用 `bash runtime/bin/state doctor`

#### Scenario: BUN_MISSING 触发三档 AskUserQuestion
- **WHEN** doctor 返回 `STATUS: BUN_MISSING`
- **THEN** SKILL.md 指示 LLM 用 AskUserQuestion 呈现三档选项：
  - "我来帮你装" → LLM 调 Bash 执行 install 命令
  - "我自己装，告诉我命令" → 展示命令等待用户外部执行
  - "取消" → 进入只读模式
- **AND** AskUserQuestion 的 question body SHALL 含完整 curl 命令、bun.sh 官方链接、安装目录、大小预估、卸载说明

#### Scenario: 平台不支持进入只读
- **WHEN** doctor 返回 `STATUS: PLATFORM_UNSUPPORTED`
- **THEN** SKILL.md 指示 LLM 告知 "本 skill 需要在 Unix-like 环境运行，请切换到 WSL"
- **AND** 提供只读模式入口（查看已有存档和结局图鉴）

### Requirement: runtime 目录平台范围声明
SKILL.md 顶部（frontmatter 之后、Phase -1 之前）SHALL 包含一段平台范围声明，明示 skill 需要 Unix-like 环境，Windows 原生 shell 不支持，推荐 WSL。

#### Scenario: 平台范围声明存在
- **WHEN** 生成 SKILL.md
- **THEN** 文件 SHALL 在 Phase -1 之前包含至少一段关于平台要求的说明
- **AND** SHALL 明确列出支持的平台：macOS / Linux / Windows+WSL
- **AND** SHALL 明确不支持：Windows 原生 cmd / PowerShell / Git Bash

### Requirement: Phase 1 剧本文件使用 JSON 格式
SKILL.md Phase 1 章节 SHALL 指示 LLM 把生成的剧本写入 `runtime/scripts/script-<id>.json`（而非 `.yaml`）。文件内容 SHALL 是合法 JSON，通过 `JSON.parse` 解析。Phase 1 模板中展示的所有 script 示例 SHALL 使用 JSON 语法。

#### Scenario: Phase 1 Write 到 .json 路径
- **WHEN** Phase 1 LLM 完成 script 创作
- **THEN** SKILL.md 指示 LLM 用 Write 工具写入 `runtime/scripts/script-<id>.json`
- **AND** SHALL NOT 写入任何 `.yaml` 路径

#### Scenario: Phase 1 模板展示 JSON 示例
- **WHEN** 生成 SKILL.md
- **THEN** Phase 1 章节的 script 结构示例 SHALL 是合法 JSON
- **AND** SHALL NOT 含 yaml 特有语法（`-` 序列、block scalar、裸 key）

#### Scenario: Phase -1 列举 .json
- **WHEN** Phase -1 列出已有剧本
- **THEN** SKILL.md 指示 LLM glob `runtime/scripts/*.json`
- **AND** SHALL NOT glob `*.yaml`

### Requirement: packager 打包 runtime/bin 和 runtime/lib
packager SHALL 在生成 skill 归档时自动注入 `runtime/bin/state`、`runtime/bin/doctor.sh` 和 `runtime/lib/` 下所有 `src/export/state/*.ts` 文件。注入的文件内容 SHALL 与 Soulkiller 源码中的版本字节相同。

#### Scenario: 归档含完整 runtime
- **WHEN** 执行 export 生成 skill 归档
- **THEN** 归档 SHALL 包含 `runtime/bin/state` 和 `runtime/bin/doctor.sh`
- **AND** 包含 `runtime/lib/main.ts` / `apply.ts` / `init.ts` / `validate.ts` / `rebuild.ts` / `reset.ts` / `schema.ts` / `mini-yaml.ts`

#### Scenario: runtime 文件可执行位
- **WHEN** 归档被解压
- **THEN** `runtime/bin/state` 和 `runtime/bin/doctor.sh` SHALL 有可执行位（归档内保留 mode 0755 或由 SKILL.md 指示 `chmod +x`）

### Requirement: expectedFileCount 排除 runtime 代码
packager 在 Phase 1 上下文预算锚点（`expectedFileCount` / `expectedTextSizeKb`）计算中 SHALL 排除 `runtime/bin/` 和 `runtime/lib/` 下的所有文件。这些是运行时代码，不属于 Phase 1 LLM 需要读取的创作素材。

#### Scenario: 预算不含 runtime
- **WHEN** packager 计算 `expectedFileCount`
- **THEN** runtime/bin/ 和 runtime/lib/ 下的文件 SHALL 不被计入
- **AND** 只计入 characters/ / world/ / story-spec.md / SKILL.md 等创作素材
