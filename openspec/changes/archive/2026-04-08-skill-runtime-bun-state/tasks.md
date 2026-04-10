## 1. 运行时基建：src/export/state/

- [x] 1.1 新建 `src/export/state/mini-yaml.ts`——扁平 yaml parser + serializer，支持 `int` / `bool` / `string` 三种值，禁止嵌套。约 40-60 行
- [x] 1.2 新建 `tests/unit/export-state-mini-yaml.test.ts`——覆盖 parse / serialize 往返、拒绝嵌套、边缘 case（含冒号值、空格、引号）
- [x] 1.3 新建 `src/export/state/schema.ts`——定义 StateSchema 类型 + loadStateSchema(scriptPath) + applyDelta(schema, state, key, rawDelta) 纯函数（int clamp、bool/enum/string overwrite）
- [x] 1.4 新建 `tests/unit/export-state-schema.test.ts`——覆盖 applyDelta 的四种类型分支 + clamp 边界 + 未知 key 报错 + enum 越界报错
- [x] 1.5 新建 `src/export/state/init.ts`——实现 `state init <slot> <script-id>`：读 script、从 initial_state 构造 state.yaml 内容、构造 meta.yaml 内容、temp-file + rename 原子写入
- [x] 1.6 新建 `src/export/state/apply.ts`——实现 `state apply <slot> <scene-id> <choice-id>`：读 script、定位 scenes[scene].choices[choice].consequences、循环调 applyDelta、事务性写两个文件、输出结构化变更摘要到 stdout
- [x] 1.7 新建 `src/export/state/validate.ts`——实现 `state validate <slot>`：复刻 Phase -1 六重校验（含"继续游戏"的第 7 重 state 字段集对齐）、返回 JSON 诊断到 stdout、不修改任何文件
- [x] 1.8 新建 `src/export/state/rebuild.ts`——实现 `state rebuild <slot>`：从 script.initial_state 重建 state.yaml，保留已有字段的合法值、用 default 填充缺失字段
- [x] 1.9 新建 `src/export/state/reset.ts`——实现 `state reset <slot>`：把 state.yaml 整体覆盖为 initial_state、meta.yaml.current_scene 重置为 scenes[0].id
- [x] 1.10 新建 `src/export/state/main.ts`——CLI dispatcher，接收 argv，根据第一个参数分派到 doctor/init/apply/validate/rebuild/reset；含 `--help` 输出六子命令列表
- [x] 1.11 新建 `tests/unit/export-state-init.test.ts`——用临时目录跑真 fs，验证 init 生成的 state.yaml 字段集 == schema 字段集、meta.yaml 含正确 script_ref
- [x] 1.12 新建 `tests/unit/export-state-apply.test.ts`——用临时目录跑真 fs，验证 apply 正确计算 int delta / bool overwrite / enum 校验、事务性、不修改不相关字段
- [x] 1.13 新建 `tests/unit/export-state-validate.test.ts`——构造六种错误存档（dangling / schema 缺失 / initial_state 不对齐 / consequences 引用错 / 共享 axes 缺失 / flags 不匹配）+ 合法存档，验证 JSON 诊断 code 和 errors 数组正确
- [x] 1.14 新建 `tests/unit/export-state-reset-rebuild.test.ts`——覆盖重置和重建语义（合并为一个文件）

## 2. runtime/bin 脚本：doctor.sh 和 state wrapper

- [x] 2.1 新建 `src/export/state/doctor.sh`——纯 POSIX sh 脚本，检测平台（macOS / Linux / WSL 接受，Windows 原生 MINGW/MSYS/CYGWIN 拒绝）、检测 `$HOME/.soulkiller-runtime/bin/bun` 是否存在并满足最低版本（暂定 1.1.0）、输出结构化 stdout（STATUS / PLATFORM / BUN_VERSION / BUN_PATH / INSTALL_CMD_UNIX / BUN_DOCS / INSTALL_DIR）
- [x] 2.2 新建 `src/export/state/state.sh`——bash wrapper，流程：若无 bun → 先调 doctor.sh 返回状态给调用者；若有 bun → exec `$HOME/.soulkiller-runtime/bin/bun` 跑 `runtime/lib/main.ts "$@"`；处理 `state doctor` 子命令直接 exec doctor.sh
- [x] 2.3 `package.json` 新增 `bun run lint:shell` 脚本（调用 `shellcheck --shell=sh` 和 `--shell=bash`）。shellcheck 未预装在本机，脚本就位后待有 shellcheck 的环境跑一次
- [x] 2.4 本地 smoke test：macOS 上直跑 doctor.sh + state.sh，覆盖 BUN_MISSING / OK / init→apply→validate 全路径。跨平台 VM / Linux 测试 deferred（需独立环境）
- [ ] 2.5 **[deferred — 需独立环境]** WSL 和 Git Bash 手动测试

## 3. packager 改造

- [x] 3.1 修改 `src/export/packager.ts`——新增 `injectRuntimeFiles(filesMap)` 函数，读取 `src/export/state/` 下所有 `.ts` 文件拷贝到 `runtime/lib/`，`doctor.sh` 拷贝到 `runtime/bin/doctor.sh`，`state.sh` 拷贝到 `runtime/bin/state`（丢 `.sh` 后缀）
- [x] 3.2 在 packager 中确保 `runtime/bin/state` 和 `runtime/bin/doctor.sh` 写入时设置可执行位——改用 fflate `[bytes, { os: 3, attrs: (0o100755 << 16) >>> 0 }]` 元组；实测 zip→unzip 后 mode 为 0755
- [x] 3.3 修改 `countMdFilesInMap` / `estimateMdTextSizeKb`——显式 `key.startsWith('runtime/')` 排除，即使未来 runtime 含 `.md` 也不会污染预算
- [x] 3.4 更新 `tests/unit/export-tools.test.ts`——新增 11 条断言覆盖 runtime/bin/state、runtime/bin/doctor.sh、runtime/lib/*.ts 的存在 + 内容特征（shebang、关键字符串）
- [x] 3.5 新增 `tests/unit/export-packager-runtime.test.ts`——单独测试 injectRuntimeFiles：byte-for-byte 拷贝、execPaths 集合正确、budget 函数 runtime 排除（7 tests）

## 4. SKILL.md 模板改写

- [x] 4.1 `allowed-tools` 增加 `Bash`，保留 `Edit` 和 `Write`（它们仍用于 Phase 1 script.json 创作，且 Phase -1 rename 需要 Write 回写 JSON）
- [x] 4.2 新增 `buildPlatformNotice()` 辅助 + 插入 frontmatter 之后、Phase -1 之前：明示 macOS / Linux / WSL 支持，Windows 原生拒绝
- [x] 4.3 `buildPhaseMinusOne()` 最前面新增 **Step 0：Runtime 健康检查**，覆盖 5 种 STATUS 分支（OK / BUN_MISSING / BUN_OUTDATED / PLATFORM_UNSUPPORTED / PLATFORM_UNKNOWN）
- [x] 4.4 `BUN_MISSING` 分支的 AskUserQuestion 模板——含完整 curl 命令、bun.sh 链接、安装目录、~90MB 预估、卸载说明；三档选项
- [x] 4.5 `PLATFORM_UNSUPPORTED` 分支的只读模式引导——列出允许动作（Read 查看）和禁止动作（init / apply / reset / rebuild）
- [x] 4.6 六重校验段落完全重写为"调 `state validate` 解析 JSON"，带完整 error code 对照表（10 种 code → LLM 动作）
- [x] 4.7 修复菜单改为调 `state rebuild` / `state reset`，明示禁止手动 Edit / Write
- [x] 4.8 「重玩某个剧本」Phase -1 入口改为调 `state init`；「从头再来」Phase 3 重玩规则改为调 `state reset`（multi + single char 两个版本都改了）
- [x] 4.9 Phase 2 场景流转规则重写——删除 apply_consequences 伪代码，替换为"调 `state apply <slot> <scene> <choice>`，读 stdout SCENE/CHANGES 摘要"（multi + single 都改了）
- [x] 4.10 禁止事项新增「状态文件直写（硬红线）」段落，显式禁止 Edit / Write 直接改 state.yaml / meta.yaml
- [x] 4.11 Phase 2 首次进入场景改为调 `state init`
- [x] 4.12 `expectedFileCount` / `expectedTextSizeKb` 由 packager.ts Group 3 改动自动排除 runtime/；模板文字无需改动
- [x] 4.13 `tests/unit/export-tools.test.ts` 的 `allowed-tools` 和 `apply_consequences` 断言同步更新（14 tests 通过）
- [x] 4.14 **Phase 1 模板改为 JSON 格式**——multi 和 single 两个版本的"剧本持久化"段落、state_schema 示例、initial_state 示例全部改写为 JSON；Write 目标路径 `.yaml` → `.json`
- [x] 4.15 Phase -1 的 `glob runtime/scripts/*.yaml` → `*.json`；`buildStateSchemaSection()` 的"script.yaml"引用 → "script.json"
- [x] 4.16 `allowed-tools` 保留 `Glob`（Phase -1 列举和 Phase 1 world 读取都需要）

## 5. SKILL.md 模板 lint 更新

- [x] 5.1 `src/export/lint/lint-skill-template.ts` 旧规则审查——现有规则集（YAML_PARSE / SCHEMA_KEY_NAMING / PLACEHOLDER_FORMAT / SHARED_AXES_COMPLETENESS / AXIS_CROSS_REF）没有硬编码"apply_consequences 伪代码必须含 Edit"的规则，无需删除；同时把 `lintStorySpec` 重构为 `lintFencedBlocksOnly`，让 runtime CLI 规则只对 SKILL.md 生效
- [x] 5.2 新增 lint 规则 `PHASE_0_DOCTOR_PRESENT`——在 `lintRuntimeCliUsage()` 中实现，扫描整个 SKILL.md 必须至少出现一次 `runtime/bin/state doctor` 调用
- [x] 5.3 新增 lint 规则 `NO_EDIT_STATE_YAML`——4 条 forbidden pattern 正则：`Edit ${CLAUDE_SKILL_DIR}/runtime/saves/.../state.yaml`、`.../meta.yaml`、裸 `Edit state.yaml:`、裸 `Edit meta.yaml:`
- [x] 5.4 新增 lint 规则 `STATE_APPLY_PRESENT`——SKILL.md 必须至少出现一次 `runtime/bin/state apply` 调用
- [x] 5.5 `tests/unit/export-lint.test.ts` 新增 "runtime CLI rules — Group 5" describe 块，11 个 tests 覆盖三条新规则的正反面 case + 真实 generated template 必须通过所有三条规则的集成断言

## 6. 端到端验证

- [x] 6.1 自动化 E2E smoke 脚本：用 `injectRuntimeFiles` 构建 mini skill + zip + 解压到临时目录 + HOME override 指向伪 bun 目录
- [x] 6.2 macOS 本机：doctor → init → apply → validate → reset → corrupt → rebuild 全流程 25 条断言通过
- [x] 6.3 已装 bun 场景：通过（bun 1.3.11 + 最低版本 1.1.0）
- [ ] 6.4 **[deferred]** WSL 验证——需要 Linux 环境
- [ ] 6.5 **[deferred]** Git Bash 拒绝验证——需要 Windows 环境
- [x] 6.6 场景切换 state.yaml / meta.yaml 变化：E2E 脚本已覆盖（trust 3→5 / flags.met false→true / current_scene scene-001→scene-002）
- [x] 6.7 损坏存档 + 修复菜单：E2E 脚本覆盖（删 trust 字段 → validate 报 FIELD_MISSING → rebuild 恢复 → 再 validate ok）
- [x] 6.8 state reset 语义：E2E 脚本覆盖（apply 改 trust 到 5 → reset → trust 回到 3 / flags 回到 false / scene 回到 scene-001）
- [ ] 6.9 **[deferred]** 拔网络模拟 bootstrap 失败——LLM 侧交互，需要 Claude Code 真实环境

## 7. 文档更新

- [x] 7.1 `CLAUDE.md` "Export / Skill format" 段落新增 skill-runtime-bun-state change 说明——bun runtime 依赖、Unix-like 范围、runtime/bin + runtime/lib 布局、错误类分界、script.yaml → script.json 原因
- [x] 7.2 `CLAUDE.md` "Architecture" 段落新增 `src/export/state/` 描述——作者侧 + 消费侧共享源码的双重角色，零 npm 依赖约束
- [x] 7.3 `CLAUDE.md` "Testing" 段落新增 skill runtime state tests 说明（91 tests 分布）+ packager runtime tests
- [x] 7.4 "旧版 skill 归档不兼容"已在 CLAUDE.md 的 skill-runtime-bun-state 段落中声明，OpenSpec proposal.md 也标注了 BREAKING——项目无独立 README，不需要额外位置
- [x] 7.5 i18n locale 文件检查完毕——`zh.json` / `ja.json` / `en.json` 中**没有**涉及 state 更新机制的文案，无需改动

## 8. OpenSpec 归档准备

- [x] 8.1 `openspec validate skill-runtime-bun-state` ✓ 通过；所有 4 个 artifact 完成
- [x] 8.2 `bun run test` ✓ 853/853 全部通过（77 个 test file，涵盖 unit / component / visual）
- [x] 8.3 `bun run build` ✓ tsc --noEmit 0 errors
- [x] 8.4 Debugger 统一检查 ✓ 新增代码无 debugger 语句，等用户指示再提交 commit
