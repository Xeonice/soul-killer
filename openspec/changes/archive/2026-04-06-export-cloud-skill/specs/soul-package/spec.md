# Soul Package Format and Distribution

## ADDED Requirements

### Requirement: readSoulFiles 函数导出

soul/package.ts SHALL 导出 `readSoulFiles(soulDir)` 函数，返回 `{ identity: string, style: string, behaviors: string[] }`，读取 Soul 目录下的 identity.md、style.md 和 behaviors/ 下所有 .md 文件的完整文本内容。Export Agent 的 `read_soul` tool 依赖此函数。

#### Scenario: 读取完整 Soul 文件

- **WHEN** 调用 `readSoulFiles("/path/to/souls/V")`
- **THEN** SHALL 返回 identity.md 的完整内容、style.md 的完整内容、behaviors/ 下所有 .md 文件内容的数组
