## ADDED Requirements

### Requirement: engine_version 模板内容基线

`runtime/engine.md` 模板 SHALL 随 `engine_version` bump 同步更新内容。本次变更 SHALL 将模板中的 Phase -1 Step 0（Runtime Health Check）章节删除，并用 Step -1.1 作为 Phase -1 首个可执行步骤。

#### Scenario: 升级后 Phase -1 无 Step 0

- **WHEN** 用户对已安装的 skill 执行 `soulkiller skill upgrade`，且内嵌 `engine_version` 已 bump 到包含本次变更的版本
- **THEN** `runtime/engine.md` 中 SHALL NOT 再包含字面量 "Step 0: Runtime Health Check"
- **AND** SHALL NOT 再包含 `soulkiller runtime doctor` 作为必执行步骤

#### Scenario: 升级后仍有安装引导分支

- **WHEN** `soulkiller skill upgrade` 完成
- **THEN** 更新后的 `runtime/engine.md` SHALL 仍包含 Phase -1 的 `command not found` → AskUserQuestion 安装引导分支
- **AND** SHALL 通过 `PHASE_MINUS_ONE_INSTALL_GUIDE_PRESENT` lint 规则

### Requirement: 示例库同步

`examples/skills/*.skill` 仓库文件 SHALL 与当前 binary 内嵌的 `engine_version` 一致。

#### Scenario: 合入包含模板变更的 change 时

- **WHEN** 本次 change（或后续任何修改 `runtime/engine.md` 模板的 change）合入 main
- **THEN** `examples/skills/fate-zero.skill` / `three-kingdoms.skill` / `white-album-2.skill` SHALL 被重新生成并覆盖提交
- **AND** 新文件的 `soulkiller.json` 中 `engine_version` SHALL 与合入时 binary 内嵌版本一致
