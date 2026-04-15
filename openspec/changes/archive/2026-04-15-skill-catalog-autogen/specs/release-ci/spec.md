## ADDED Requirements

### Requirement: Tag 触发后的 README 同步步骤

`.github/workflows/release.yml` SHALL 在 `v*` tag 触发、跑完测试、开始交叉编译**之前**，新增一个步骤：`bun scripts/build-skill-catalog.ts`。若脚本修改了 `README.md`，workflow SHALL 用 `github-actions[bot]` 身份 commit 该修改（commit 信息含 tag 版本号），push 回 `main` 分支，然后继续后续构建步骤。

#### Scenario: README 需要同步

- **WHEN** 推送 tag `v0.7.0` 触发 workflow，脚本执行后 `README.md` 发生变化
- **THEN** workflow SHALL 执行 `git add README.md && git commit -m "chore(readme): sync skill catalog for v0.7.0" && git push origin HEAD:main`
- **AND** 随后进入交叉编译与 Release 创建步骤，二进制产物与 Release 不受影响

#### Scenario: README 已经最新

- **WHEN** 推送 tag `v0.7.0` 触发 workflow，脚本执行后 `README.md` 无变化
- **THEN** workflow SHALL 跳过 commit 步骤，直接进入下一阶段

#### Scenario: push 失败

- **WHEN** push 回 main 被保护分支规则拒绝（例如要求 PR）
- **THEN** workflow SHALL 失败并暴露错误日志；release 产物不创建；由维护者介入
