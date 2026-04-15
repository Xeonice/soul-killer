## ADDED Requirements

### Requirement: Skill archive 纯数据契约

Skill archive（`.skill` 归档文件）SHALL 仅包含数据文件与 LLM prompt。具体白名单（前缀匹配）：

- `SKILL.md`（顶层 prompt）
- `soulkiller.json`（元数据）
- `story-spec.md`（故事结构定义）
- `souls/**`（角色数据）
- `world/**`（世界数据）
- `runtime/engine.md`（执行协议 prompt，非代码）
- `runtime/scripts/**`（binary 产出的 script JSON + 占位 .gitkeep）
- `runtime/saves/**`（binary 产出的 state / meta yaml + 占位 .gitkeep）
- `runtime/tree/**`（binary 启动 viewer server 时写入的 PID / 元信息）

Archive SHALL NOT 含任何 `.ts` / `.js` / `.mjs` / `.cjs` / `.sh` / `.bat` / `.ps1` / `.py` / `.rb` 等可执行格式，也 SHALL NOT 含白名单外的顶级目录（如 `lib/` / `bin/` / `src/`）。`.DS_Store` 这种 macOS Finder 元数据由打包/升级脚本通过 basename 匹配自动剥离。违反任一即为契约违规。

#### Scenario: 合规 archive 通过校验

- **WHEN** 新导出 skill archive 的所有条目均匹配白名单
- **THEN** 契约校验（unit test / CI job）返回 0；allowed 计数 = total entry 计数

#### Scenario: archive 含 .ts 文件

- **WHEN** archive 中任一条目路径以 `.ts` 结尾（例如 `runtime/lib/apply.ts`）
- **THEN** 校验 SHALL fail；错误消息列出违规条目与匹配失败的白名单规则

#### Scenario: archive 含白名单外顶级目录

- **WHEN** archive 出现 `src/` / `lib/` / 其他未登记目录
- **THEN** 校验 SHALL fail；提示该路径不在白名单

### Requirement: Binary 为状态 mutation 唯一权威

所有对 skill 归档下 `runtime/saves/` 与 `runtime/scripts/` 的写操作 SHALL 经 `soulkiller runtime <subcommand>` 执行。Skill archive 内 SHALL NOT 含任何可被 LLM 当代码加载或执行的文件（见 "Skill archive 纯数据契约"）。SKILL.md / engine.md 的指令 SHALL 只引用 `soulkiller <cmd>` 作为命令入口，不得指示 LLM 加载归档内的代码。

#### Scenario: engine.md 合规

- **WHEN** 扫描 `runtime/engine.md` 里的所有命令示例
- **THEN** 每条命令 SHALL 以 `soulkiller` 起头；SHALL NOT 出现 `bash runtime/` / `bun runtime/lib/` / `node runtime/`

#### Scenario: LLM 禁止 Edit state/meta

- **WHEN** SKILL.md / engine.md 中包含状态/元数据修改的说明
- **THEN** 文档 SHALL 明确禁止使用 Edit / Write 工具直接改 `state.yaml` / `meta.yaml`；所有 mutation 指向 `soulkiller runtime <init|apply|reset|rebuild|save|load|script*>` 命令

### Requirement: CI 契约守护 job

`.github/workflows/ci.yml` SHALL 新增 `verify-skill-archive-purity` job：用 fixture 驱动 `packageSkill` 产出一个测试 archive；扫 zip 条目并对照白名单。任一不匹配 → job fail；错误日志含违规条目列表 + 白名单说明。

#### Scenario: 健康 PR

- **WHEN** PR 没有改动 archive 结构
- **THEN** job 通过

#### Scenario: 有人把 .ts 加回 archive

- **WHEN** PR 恢复 `injectRuntimeFiles` 或类似逻辑
- **THEN** job fail；PR 状态标红；错误消息指向 CLAUDE.md Skill/Binary Contract 段落
