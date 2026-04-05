## ADDED Requirements

### Requirement: World manifest schema
系统 SHALL 定义 `WorldManifest` 接口，包含以下字段：`name`（kebab-case 标识符）、`display_name`（显示名）、`version`（语义化版本）、`created_at`（ISO 8601）、`description`（描述）、`entry_count`（条目数量）以及 `defaults`（含 `context_budget: number` 和 `injection_position: 'before_soul' | 'after_soul' | 'interleaved'`）。

#### Scenario: 创建新世界 manifest
- **WHEN** 调用 `createWorldManifest(name, displayName, description)`
- **THEN** 返回 WorldManifest 对象，version 为 `"0.1.0"`，created_at 为当前时间，entry_count 为 0，defaults.context_budget 为 2000，defaults.injection_position 为 `"after_soul"`

### Requirement: World 存储目录结构
系统 SHALL 将世界存储在 `~/.soulkiller/worlds/<name>/` 目录下，包含 `world.json`（WorldManifest 序列化）和 `entries/` 子目录。

#### Scenario: 世界目录初始化
- **WHEN** 创建名为 "night-city" 的世界
- **THEN** 创建目录 `~/.soulkiller/worlds/night-city/`，写入 `world.json`，创建空的 `entries/` 目录

### Requirement: World CRUD 操作
系统 SHALL 提供 `createWorld`、`loadWorld`、`deleteWorld`、`listWorlds` 函数。`listWorlds` SHALL 返回所有已安装世界的 manifest 信息。

#### Scenario: 列出所有世界
- **WHEN** `~/.soulkiller/worlds/` 下存在 "night-city" 和 "corpo-life" 两个世界目录
- **THEN** `listWorlds()` 返回包含两个 WorldManifest 的数组

#### Scenario: 删除世界
- **WHEN** 调用 `deleteWorld("night-city")`
- **THEN** 删除 `~/.soulkiller/worlds/night-city/` 整个目录

### Requirement: World 版本管理
WorldManifest 的 `version` 字段 SHALL 遵循语义化版本格式。每次 evolve 操作后 SHALL 自动递增 patch 版本号。

#### Scenario: Evolve 后版本递增
- **WHEN** 当前世界版本为 "0.1.0"，执行 world evolve 完成后
- **THEN** 版本更新为 "0.1.1"
