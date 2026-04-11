## ADDED Requirements

### Requirement: 两阶段构建产出全平台二进制

`scripts/build.ts` SHALL 执行两阶段构建：先 bundle（含 devtools stub plugin），再对 5 个目标平台执行 `bun build --compile`。

#### Scenario: 成功构建全部平台

- **WHEN** 执行 `bun scripts/build.ts`
- **THEN** `dist/` 下 SHALL 产出 5 个文件：`soulkiller-darwin-arm64`、`soulkiller-darwin-x64`、`soulkiller-linux-x64`、`soulkiller-linux-arm64`、`soulkiller-windows-x64.exe`

### Requirement: 版本号注入

构建时 SHALL 从 `package.json` 读取 `version` 字段，通过 `--define` 注入到 bundle 中作为 `process.env.SOULKILLER_VERSION`。

#### Scenario: 二进制包含正确版本

- **WHEN** `package.json` 版本为 `0.2.0` 并执行构建
- **THEN** 产出的二进制执行 `--version` 时 SHALL 输出 `0.2.0`

### Requirement: react-devtools-core 被 stub 替换

bundle 阶段 SHALL 通过 plugin 将 `react-devtools-core` 替换为空模块，避免运行时依赖缺失。

#### Scenario: 编译后无 devtools 错误

- **WHEN** 执行编译后的二进制（TTY 环境）
- **THEN** 不 SHALL 出现 `react-devtools-core` 相关错误

### Requirement: 产出压缩包

构建脚本 SHALL 将 Unix 平台二进制压缩为 `.tar.gz`，Windows 二进制压缩为 `.zip`。

#### Scenario: 压缩产物命名

- **WHEN** 构建完成
- **THEN** `dist/` 下 SHALL 包含 `soulkiller-darwin-arm64.tar.gz`、`soulkiller-windows-x64.zip` 等压缩文件
