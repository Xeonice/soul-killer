## ADDED Requirements

### Requirement: --version flag 输出版本号

`soulkiller --version` SHALL 在 ink 渲染前输出版本号并退出。

#### Scenario: 查看版本

- **WHEN** 执行 `soulkiller --version`
- **THEN** SHALL 输出 `soulkiller 0.2.0`（版本号来自构建时注入）并以 exit code 0 退出

### Requirement: --update flag 触发自我更新

`soulkiller --update` SHALL 查询 GitHub Release 最新版本，若有新版本则下载替换当前二进制。

#### Scenario: 有新版本可用

- **WHEN** 当前版本 `0.1.0`，GitHub 最新 Release 为 `v0.2.0`
- **THEN** SHALL 下载对应平台的新二进制，替换 `process.execPath`，打印更新成功信息

#### Scenario: 已是最新版本

- **WHEN** 当前版本与 GitHub 最新 Release 一致
- **THEN** SHALL 打印"已是最新版本"并退出

#### Scenario: 网络失败

- **WHEN** 无法连接 GitHub API
- **THEN** SHALL 打印明确的网络错误信息并以非零 exit code 退出

### Requirement: 原子替换二进制

更新过程 SHALL 先下载到临时文件，验证完整后再 rename 替换，确保失败不损坏当前二进制。

#### Scenario: 下载中断不影响当前版本

- **WHEN** 下载新版本过程中网络中断
- **THEN** 当前二进制 SHALL 保持不变，可继续正常使用




