## MODIFIED Requirements

### Requirement: Phase -1 脚本发现

Phase -1 Step -1.1 SHALL 使用 `soulkiller runtime scripts` 命令发现已有脚本，而非依赖 Glob 工具搜索文件。

#### Scenario: 通过 CLI 命令判断首次游玩

- **WHEN** LLM 执行 `soulkiller runtime scripts` 且输出 `count` 为 0
- **THEN** SHALL 跳过 Step -1.2，直接进入 Phase 0（首次游玩）

#### Scenario: 通过 CLI 命令发现已有脚本

- **WHEN** LLM 执行 `soulkiller runtime scripts` 且输出 `count` 大于 0
- **THEN** SHALL 进入 Step -1.2 解析各脚本详情
