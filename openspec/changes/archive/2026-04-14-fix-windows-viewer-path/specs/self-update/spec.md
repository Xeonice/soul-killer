## ADDED Requirements

### Requirement: Viewer 静态资源更新前自愈父目录

`runUpdate` 在 `renameSync` 替换 `~/.soulkiller/viewer` 之前 SHALL 调用 `mkdirSync(dirname(viewerDst), { recursive: true })` 确保父目录存在。Windows 首次安装后 `~/.soulkiller/` 可能从未被创建，直接 rename 会抛 `ENOENT` 导致升级中断。

#### Scenario: Windows 首次安装后升级

- **WHEN** Windows 用户刚通过 `install.ps1` 安装，`%USERPROFILE%\.soulkiller\` 目录不存在
- **AND** 用户执行 `soulkiller --update` 且下载的 archive 包含 `viewer/` 子目录
- **THEN** SHALL 先建出 `%USERPROFILE%\.soulkiller\` 父目录
- **AND** SHALL 成功将新 viewer 重命名到 `%USERPROFILE%\.soulkiller\viewer`
- **AND** SHALL 输出 `✓ Viewer files updated`
- **AND** 升级流程 SHALL 以 exit code 0 完成

#### Scenario: 父目录已存在

- **WHEN** `~/.soulkiller/` 已存在（典型 Unix 场景或已升级过的 Windows）
- **THEN** `mkdirSync(recursive: true)` SHALL 为 no-op
- **AND** 后续 rename SHALL 按原逻辑执行

#### Scenario: Archive 不含 viewer

- **WHEN** 下载的 archive 中 `viewer/` 不存在
- **THEN** SHALL 跳过 viewer 替换分支（含 mkdirSync 调用）
- **AND** SHALL NOT 误建空的 `~/.soulkiller/` 目录
