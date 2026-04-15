## ADDED Requirements

### Requirement: Tag push 触发自动发布

`.github/workflows/release.yml` SHALL 在 `v*` tag push 时触发，自动构建全平台二进制并创建 GitHub Release。

#### Scenario: 推送 tag 触发构建

- **WHEN** 推送 tag `v0.2.0`
- **THEN** GitHub Actions SHALL 触发 release workflow

### Requirement: 单 runner 交叉编译

CI SHALL 在单个 ubuntu runner 上完成全部 5 个平台的交叉编译，不使用构建矩阵。

#### Scenario: ubuntu 上编译全部目标

- **WHEN** release workflow 运行
- **THEN** SHALL 在一个 job 中产出 darwin-arm64、darwin-x64、linux-x64、linux-arm64、windows-x64 共 5 个二进制

### Requirement: 自动创建 GitHub Release

CI SHALL 使用 `gh release create` 创建 Release，上传全部压缩产物和安装脚本。

#### Scenario: Release 产物完整

- **WHEN** release workflow 完成
- **THEN** GitHub Release SHALL 包含：5 个压缩二进制 + `install.sh` + `install.ps1`

### Requirement: 测试通过后才发布

CI SHALL 在构建前执行 `bun run test`，测试失败时 SHALL 中止发布。

#### Scenario: 测试失败中止发布

- **WHEN** `bun run test` 失败
- **THEN** workflow SHALL 失败，不创建 Release


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
