## ADDED Requirements

### Requirement: `runtime load` 恢复指定 save 到 auto

`soulkiller runtime load <script-id> <save-type>` SHALL 把指定 save 的 `state.yaml` / `meta.yaml` / `history.log` 完整拷贝覆盖到该 script 的 `auto/` 目录；`meta.yaml.lastPlayedAt` 更新为当前时间。`<save-type>` SHALL 为 `manual:<timestamp>` 格式；`auto` 不允许（无实际意义）。成功 stdout 输出多行文本含 `source` / `target` / `fields`；失败 stderr + 退出码 1；参数错退出码 2。

#### Scenario: 正常恢复 manual save

- **WHEN** 存在 `runtime/saves/<id>/manual/<ts>/state.yaml` 且有效
- **THEN** 执行 `soulkiller runtime load <id> manual:<ts>` 后 `runtime/saves/<id>/auto/state.yaml` 内容 SHALL 与 manual 完全一致；`auto/meta.yaml.lastPlayedAt` 更新；`auto/history.log` 复制自 manual

#### Scenario: manual save 不存在

- **WHEN** 指定 timestamp 对应目录不存在
- **THEN** 命令 SHALL 退出码 1；stderr 指明 `manual save "<ts>" not found`；`auto/` 不被修改

#### Scenario: load auto 被拒

- **WHEN** 调用 `soulkiller runtime load <id> auto`
- **THEN** 退出码 2；stderr 提示 `load only applies to manual saves; use "init" / "reset" for auto`

#### Scenario: 覆盖非空 auto 的 warning

- **WHEN** auto 已存在且 scene / state 与即将 load 的 manual 不同
- **THEN** 命令 SHALL 在 stderr 打 `WARNING: auto save will be overwritten`；仍执行覆盖（与 CLI 其他命令无交互式确认的原则一致）

### Requirement: `runtime save --delete` 删除指定 manual save

`soulkiller runtime save <script-id> --delete <timestamp>` SHALL 删除指定 manual save 目录；成功输出 `DELETED\n  timestamp: <ts>` 到 stdout；manual 不存在报错退出码 1；同时传 `--overwrite` 与 `--delete` 退出码 2（互斥）。

#### Scenario: 删除存在的 manual

- **WHEN** `runtime/saves/<id>/manual/<ts>/` 存在
- **THEN** 命令执行后该目录 SHALL 被删除；其他 manual saves 与 auto 不受影响

#### Scenario: manual 不存在

- **WHEN** 指定 timestamp 无对应目录
- **THEN** 退出码 1；stderr 含 `manual save "<ts>" not found`

#### Scenario: --delete 与 --overwrite 互斥

- **WHEN** 同时传 `--delete <ts>` 和 `--overwrite <ts>`
- **THEN** 退出码 2；stderr 说明两者互斥

### Requirement: `soulkiller runtime --help` 不依赖 SKILL_ROOT

`soulkiller runtime --help` / `-h` / 无参 SHALL 直接打印命令清单，不要求 `--root` 或 `CLAUDE_SKILL_DIR` 已设。其它需要 skill 上下文的子命令仍然要求 SKILL_ROOT 可解析（沿用现有行为）。

#### Scenario: 全新机器查 help

- **WHEN** 用户在没有 skill 安装的机器上跑 `soulkiller runtime --help`
- **THEN** 退出码 0；stdout 列出全部子命令；stderr 不含 "CLAUDE_SKILL_DIR not set" 错误

#### Scenario: 真正需要 root 的子命令仍然检查

- **WHEN** 用户跑 `soulkiller runtime apply foo bar baz` 但未设 `--root` / `CLAUDE_SKILL_DIR`
- **THEN** 退出码 1；stderr 含 `CLAUDE_SKILL_DIR not set`

### Requirement: `__pack-fixture` 隐藏烟雾命令

soulkiller binary SHALL 提供隐藏子命令 `soulkiller __pack-fixture <story> <soul> <world> <out-dir>`，直接驱动 `packageSkill` 用户已有的 soul / world 数据产出 `.skill` 归档；用于验证 binary 模式下打包流水线（区别于 dev 模式下的 vitest）。命令名以 `__` 前缀标记 internal，不出现在 `--help` 列表，不进入用户文档。

#### Scenario: 真实素材打包

- **WHEN** 用户已有 `~/.soulkiller/souls/V/` 与 `~/.soulkiller/worlds/Fate Stay Night/` 数据，跑 `soulkiller __pack-fixture smoke V "Fate Stay Night" /tmp/out`
- **THEN** 退出码 0；stdout 输出 JSON `{output_file, file_count}`；`/tmp/out/smoke-in-fate-stay-night.skill` 文件存在

#### Scenario: 缺参数

- **WHEN** 调用 `soulkiller __pack-fixture`（无参数）
- **THEN** 退出码 2；stderr 打印 usage 行

### Requirement: `runtime script clean` 清理草稿

`soulkiller runtime script clean <id>` SHALL 删除该 script 的所有中间草稿文件（`plan.json` / `scene-*.json` / `ending-*.json`），保留最终 `script-<id>.json`。输出 `CLEANED\n  drafts_removed: N\n  script_preserved: <path>` 到 stdout。幂等。

#### Scenario: 有草稿 + 已 build

- **WHEN** 同目录下存在 `plan.json`、2 份 `scene-*.json`、3 份 `ending-*.json`、1 份 `script-<id>.json`
- **THEN** 命令执行后 SHALL 只保留 `script-<id>.json`；6 个草稿 SHALL 被删除；stdout 报 `drafts_removed: 6`

#### Scenario: 只有草稿无已 build

- **WHEN** 草稿存在但 `script-<id>.json` 不存在（中途放弃）
- **THEN** 草稿 SHALL 被删；stdout 指出 `script_preserved: (none)` 或类似；退出码 0

#### Scenario: 无任何文件

- **WHEN** 目录下无草稿、无最终 script
- **THEN** 退出码 0；`drafts_removed: 0`

## MODIFIED Requirements

### Requirement: Phase -1 脚本发现

Phase -1 SHALL 通过 `soulkiller runtime scripts` 列出该 skill 所有已生成的 script。用户选择某 script 后，Phase -1 SHALL 呈现该 script 的 save 子菜单（auto / 最多 3 份 manual / 🆕 从头开始）。选择 save 后的加载流程 SHALL 按以下顺序：

1. 判定 save-type 为 `auto` 或 `manual:<ts>`
2. 执行 `soulkiller runtime validate <id> <save-type> --continue`
3. **若 save-type 为 manual:<ts>，执行 `soulkiller runtime load <id> manual:<ts>`** 把该 manual 复制到 auto
4. Read `runtime/saves/<id>/auto/state.yaml` 到 context（注意：统一读 auto，不再按 save-type 分支）
5. 进入 Phase 2

选 "🆕 从头开始" 时，执行 `soulkiller runtime init <id>`（不经 load / validate）。

#### Scenario: 从 manual save 继续

- **WHEN** 用户选 `manual:1728123456`
- **THEN** 依次执行 validate → load → Read；Phase 2 apply 永远作用于 auto；无 timeline 分叉

#### Scenario: 从 auto 继续

- **WHEN** 用户选 auto
- **THEN** 执行 validate → Read auto；跳过 load 步；Phase 2 与之前行为一致

#### Scenario: 全新开始

- **WHEN** 用户选 "🆕 从头开始"
- **THEN** 执行 init；auto 被重置为 initial_state；Phase 2 从 first_scene 开始
