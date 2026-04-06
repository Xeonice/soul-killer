# Soul Package Format and Distribution

## MODIFIED Requirements

### Requirement: readSoulFiles 函数导出

soul/package.ts SHALL 导出 `readSoulFiles(soulDir)` 函数，返回 `{ identity: string, style: string, behaviors: string[], capabilities: string, milestones: string }`。capabilities 和 milestones 在文件不存在时返回空字符串（向后兼容）。

#### Scenario: 读取包含新文件的 Soul

- **WHEN** 调用 `readSoulFiles` 且 soul 目录包含 capabilities.md 和 milestones.md
- **THEN** 返回结果 SHALL 包含这两个文件的完整内容

#### Scenario: 读取旧 Soul（无新文件）

- **WHEN** 调用 `readSoulFiles` 且 soul 目录不包含 capabilities.md 或 milestones.md
- **THEN** capabilities 和 milestones 字段 SHALL 返回空字符串
- **AND** 不抛出错误
