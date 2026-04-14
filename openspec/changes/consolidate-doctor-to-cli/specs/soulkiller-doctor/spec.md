## ADDED Requirements

### Requirement: soulkiller doctor 顶层命令

soulkiller 二进制 SHALL 支持 `soulkiller doctor [path]` 顶层子命令，作为排障入口。命令 MUST 不进入 REPL / ink 渲染，直接输出结构化 `KEY: value` 到 stdout。

#### Scenario: 无参自检

- **WHEN** 执行 `soulkiller doctor`（不带参数）
- **THEN** stdout SHALL 按顺序输出 `STATUS: OK`、`SOULKILLER_VERSION: <version>`、`BUN_VERSION: <version>`、`PLATFORM: <os>-<arch>`
- **AND** exit code SHALL 为 0

#### Scenario: 带 skill 归档路径

- **WHEN** 执行 `soulkiller doctor /path/to/skill`，且路径指向已解压的 skill 根目录
- **THEN** stdout SHALL 包含 binary 自检的 4 个字段
- **AND** SHALL 追加 `SKILL_PATH: <path>`、`SKILL_MD: OK`、`RUNTIME_LIB_MAIN: OK`、`RUNTIME_LIB_FILES: <n>/<n>` 检查字段
- **AND** 若有 `runtime/scripts/` 目录，SHALL 追加 `RUNTIME_SCRIPTS_DIR: OK (<n> scripts)`
- **AND** 所有字段 OK 时 SHALL 输出 `STATUS: OK` 并 exit 0

### Requirement: skill 归档完整性检查

`soulkiller doctor <path>` SHALL 校验 skill 归档关键文件存在；任一关键项缺失时 SHALL 输出 `STATUS: FAIL` 并 exit 1。

#### Scenario: SKILL.md 缺失

- **WHEN** 执行 `soulkiller doctor <path>`，但 `<path>/SKILL.md` 不存在
- **THEN** stdout SHALL 输出 `SKILL_MD: MISSING`
- **AND** stdout SHALL 输出 `STATUS: FAIL`
- **AND** exit code SHALL 为 1

#### Scenario: runtime/lib/main.ts 缺失

- **WHEN** `<path>/runtime/lib/main.ts` 不存在
- **THEN** stdout SHALL 输出 `RUNTIME_LIB_MAIN: MISSING`
- **AND** stdout SHALL 输出 `STATUS: FAIL`
- **AND** exit code SHALL 为 1

#### Scenario: runtime/lib 文件不全

- **WHEN** `<path>/runtime/lib/` 存在但缺少任一必需 `.ts` 文件（schema.ts / io.ts / mini-yaml.ts / script.ts / init.ts / apply.ts / validate.ts / rebuild.ts / reset.ts / save.ts / list.ts / history.ts / tree.ts / tree-server.ts / tree-html.ts / script-builder.ts / route.ts / main.ts 列表基线）
- **THEN** stdout SHALL 输出 `RUNTIME_LIB_FILES: <found>/<expected>`
- **AND** stdout SHALL 输出 `STATUS: FAIL`
- **AND** exit code SHALL 为 1

#### Scenario: 非 skill 目录

- **WHEN** 执行 `soulkiller doctor <path>`，但 `<path>` 下没有 `SKILL.md` 也没有 `runtime/` 子目录
- **THEN** stdout SHALL 输出 `SKILL_PATH: <path>`、`SKILL_MD: MISSING`、`STATUS: FAIL`
- **AND** SHALL NOT 做其他启发式猜测
- **AND** exit code SHALL 为 1

### Requirement: doctor 输出协议

所有 `soulkiller doctor` 输出 SHALL 遵循每行一条 `KEY: value` 的格式；键 SHALL 使用全大写下划线。

#### Scenario: 正常输出结构

- **WHEN** `soulkiller doctor` 正常退出
- **THEN** stdout 每行 SHALL 匹配 `^[A-Z][A-Z0-9_]*: .+$` 或为空行
- **AND** stderr SHALL 只在发生诊断性错误时输出（info/warning 不写 stderr）
