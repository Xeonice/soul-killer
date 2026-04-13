## ADDED Requirements

### Requirement: scripts 子命令列出所有已生成脚本

`soulkiller runtime scripts` SHALL 扫描 `runtime/scripts/` 目录下所有 `script-*.json` 文件，解析每个文件的顶层元数据字段，输出结构化 JSON。

#### Scenario: 存在多个脚本

- **WHEN** `runtime/scripts/` 下有 `script-aaa.json` 和 `script-bbb.json`
- **THEN** SHALL 输出 JSON，`count` 为 2，`scripts` 数组包含两个条目，每个条目包含 `id`、`title`、`generated_at`、`file` 字段

#### Scenario: 无脚本文件

- **WHEN** `runtime/scripts/` 下没有 `script-*.json` 文件
- **THEN** SHALL 输出 `{"scripts": [], "count": 0}`

#### Scenario: 脚本文件 JSON 解析失败

- **WHEN** 某个 `script-*.json` 文件内容损坏无法解析
- **THEN** SHALL 在该条目中包含 `error` 字段描述错误原因，不中断其他脚本的列出

### Requirement: 忽略非脚本文件

`scripts` 子命令 SHALL 只匹配 `script-*.json` 模式的文件，忽略 `.gitkeep`、`.build-*` 目录等其他内容。

#### Scenario: 目录含非脚本文件

- **WHEN** `runtime/scripts/` 下有 `.gitkeep`、`.build-xxx/` 和 `script-aaa.json`
- **THEN** SHALL 仅输出 `script-aaa.json` 对应的条目，`count` 为 1
