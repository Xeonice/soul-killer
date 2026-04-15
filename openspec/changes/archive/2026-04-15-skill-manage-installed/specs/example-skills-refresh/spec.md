## ADDED Requirements

### Requirement: 废弃路径剔除规则集

`scripts/upgrade-example-skills.ts` SHALL 维护一份"废弃路径规则集"，在升级流程中从 `.skill` 归档里移除这些路径。规则集以数组形式在脚本里集中声明，至少包含：`runtime/bin/state`、`runtime/bin/doctor.sh`、`runtime/bin/`（若为空目录）。未来废弃路径 SHALL 通过追加规则集来清理。

#### Scenario: 剔除 bash wrapper 残留

- **WHEN** 升级 `examples/skills/fate-zero.skill`，归档内含 `runtime/bin/state` 与 `runtime/bin/doctor.sh`
- **THEN** 升级后产出的 zip SHALL 不含 `runtime/bin/` 下的任何文件；顶层 `runtime/lib/` 与其他路径保持不变

#### Scenario: 不影响干净的归档

- **WHEN** 升级一个不含任何规则集路径的 `.skill`
- **THEN** 归档内容 SHALL 与废弃剔除前完全一致（仅 engine.md + soulkiller.json 按常规流程 bump）

### Requirement: `--check` dry-run 模式

`scripts/upgrade-example-skills.ts` SHALL 支持 `--check` 参数：不写任何文件；对每个 `examples/skills/*.skill` 计算"若执行升级会产生的 diff"；若任一 example 有 diff，退出码 SHALL 为非零（约定为 1），并打印每条过期归档的摘要（slug、过期原因：engine-outdated / deprecated-paths-present）。

#### Scenario: 全部新鲜

- **WHEN** 所有 `examples/skills/*.skill` 的 engine.md 与 catalog engine_version 一致且不含规则集路径
- **THEN** stdout 输出 `All examples up to date`；退出码 0

#### Scenario: 存在过期 example

- **WHEN** 至少一个 example 的 engine.md 过期或含废弃路径
- **THEN** stdout 按行输出每条过期归档的 slug 与原因；退出码 1；不修改任何文件

### Requirement: CI 守护 example 新鲜度

仓库 CI SHALL 在 PR 触发（`pull_request` 事件）时跑 `bun scripts/upgrade-example-skills.ts --check`；若 PR 修改涉及 `examples/skills/**`、`src/export/**`、`scripts/upgrade-example-skills.ts`、`src/cli/skill-install/**` 任一路径，该守护 SHALL 阻断合并直到 example 被重新升级提交。

#### Scenario: 修改 src/export 但未更新 example

- **WHEN** PR 修改 `src/export/spec/skill-template.ts`，`--check` 发现 `examples/skills/fate-zero.skill` 的 engine.md 过期
- **THEN** CI job `verify-examples` SHALL 失败；PR 状态显示红叉，不允许合并

#### Scenario: 修改并同步更新 example

- **WHEN** PR 同时修改 `src/export/...` 与 `examples/skills/*.skill`（已跑过 upgrade 脚本）
- **THEN** `verify-examples` 通过；PR 可合并

#### Scenario: fork PR 无写权限

- **WHEN** PR 来自非本仓库 fork
- **THEN** CI 同样跑 `--check`；检测到问题仅以警告评论或 check 结果展示，不强制阻断（或按维护者配置决定），避免 fork 协作被卡

### Requirement: scanner 支持 example 归档扫描

`scanInstalled` 的扩展能力 SHALL 允许以 `.skill` 归档为输入来源：解开到临时目录 → 读取 `soulkiller.json` → 产出与已装目录等价的 `InstallRecord`（`target` 字段值为 `"example"`、`path` 指向归档路径）。`soulkiller skill list --examples` SHALL 使用该能力扫描 `examples/skills/*.skill`。

#### Scenario: 本地扫描 examples 目录

- **WHEN** 用户执行 `soulkiller skill list --examples`
- **THEN** 输出每个 `examples/skills/*.skill` 的版本 / engine_version / 是否有废弃路径 / 与 catalog 的 diff 状态

#### Scenario: 与 catalog 对照发现过期

- **WHEN** `--examples` 扫描发现某归档 engine_version 低于 `CURRENT_ENGINE_VERSION` 或有废弃路径
- **THEN** 输出标注 `needs-upgrade`；并提示使用 `bun scripts/upgrade-example-skills.ts`
