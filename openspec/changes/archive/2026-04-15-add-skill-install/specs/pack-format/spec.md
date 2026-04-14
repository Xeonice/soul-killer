## MODIFIED Requirements

### Requirement: pack 解压实现
`.soul.pack` / `.world.pack` 解包 SHALL 使用纯 TypeScript 实现（`fflate.gunzipSync` + `nanotar.parseTar`），不得通过 `child_process.exec`/`execSync`/`execFile` 调用系统 `tar` 可执行文件。该要求在 Windows / Linux / macOS 三端必须行为一致。

#### Scenario: Unix 解包
- **WHEN** 用户在 Linux 或 macOS 上执行 `/unpack foo.soul.pack`
- **THEN** 解包过程不 spawn 任何子进程，纯 JS 完成 gunzip + tar parse

#### Scenario: Windows 解包
- **WHEN** 用户在 Windows 上执行 `/unpack foo.soul.pack`
- **THEN** 解包过程不调用 `tar.exe` / PowerShell，纯 JS 完成；与 Unix 行为一致

#### Scenario: 格式兼容性
- **WHEN** 用新版 CLI 解包旧版生成的 `.soul.pack` / `.world.pack`
- **THEN** 所有既有文件条目正确还原，含文件内容与相对路径；老版 pack 格式未变更
