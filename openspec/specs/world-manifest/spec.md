## ADDED Requirements

### Requirement: World manifest schema
系统 SHALL 定义 `WorldManifest` 接口，包含以下字段：`name`（kebab-case 标识符）、`display_name`（显示名）、`version`（语义化版本）、`created_at`（ISO 8601）、`description`（描述）、`entry_count`（条目数量）、`defaults`（含 `context_budget: number` 和 `injection_position: 'before_soul' | 'after_soul' | 'interleaved'`）、`worldType`（WorldType）、`tags`（WorldTagSet）。MAY 包含可选字段：`classification`（WorldClassification）、`sources`（`{ type: string; path_or_url?: string }[]`）、`origin`（string，来源作品/地点）、`evolve_history`（WorldEvolveHistoryEntry[]）。

#### Scenario: 创建新世界 manifest
- **WHEN** 调用 `createWorldManifest(name, displayName, description, worldType, tags)`
- **THEN** 返回 WorldManifest 对象，version 为 `"0.1.0"`，created_at 为当前时间，entry_count 为 0，defaults.context_budget 为 2000，defaults.injection_position 为 `"after_soul"`，worldType 为传入值，tags 为传入值，evolve_history 为空数组

#### Scenario: 加载旧格式 manifest 向后兼容
- **WHEN** 读取不包含 worldType/tags 字段的旧版 world.json
- **THEN** worldType 默认为 `'fictional-existing'`，tags 默认为 `emptyWorldTagSet()`，evolve_history 默认为 `[]`

### Requirement: World 存储目录结构
系统 SHALL 将世界存储在 `~/.soulkiller/worlds/<name>/` 目录下，包含 `world.json`（WorldManifest 序列化）和 `entries/` 子目录。

#### Scenario: 世界目录初始化
- **WHEN** 创建名为 "night-city" 的世界
- **THEN** 创建目录 `~/.soulkiller/worlds/night-city/`，写入 `world.json`，创建空的 `entries/` 目录

### Requirement: World CRUD 操作
系统 SHALL 提供 `createWorld`、`loadWorld`、`deleteWorld`、`listWorlds` 函数。`createWorld` SHALL 接受 worldType 和 tags 参数。`loadWorld` SHALL 对缺失的新字段填充默认值。`listWorlds` SHALL 返回所有已安装世界的 manifest 信息。

#### Scenario: 创建带类型和标签的世界
- **WHEN** 调用 `createWorld(name, displayName, description, 'real', worldTags)`
- **THEN** 创建目录和 world.json，manifest 包含 worldType: 'real' 和传入的 tags

#### Scenario: 列出所有世界
- **WHEN** `~/.soulkiller/worlds/` 下存在 "night-city" 和 "corpo-life" 两个世界目录
- **THEN** `listWorlds()` 返回包含两个 WorldManifest 的数组

### Requirement: World 版本管理
WorldManifest 的 `version` 字段 SHALL 遵循语义化版本格式。每次 evolve 操作后 SHALL 自动递增 patch 版本号。

#### Scenario: Evolve 后版本递增
- **WHEN** 当前世界版本为 "0.1.0"，执行 world evolve 完成后
- **THEN** 版本更新为 "0.1.1"

### Requirement: WorldEvolveHistoryEntry
系统 SHALL 定义 `WorldEvolveHistoryEntry` 接口，包含：`timestamp`（ISO 8601）、`sources`（`{ type: string; path_or_url?: string; entry_count: number }[]`）、`dimensions_updated`（WorldDimension[]）、`total_entries_after`（number）。

#### Scenario: 记录 evolve 历史
- **WHEN** 世界执行 evolve 操作，新增 3 个 entry
- **THEN** evolve_history 追加一条记录，包含时间戳、数据源信息、更新的维度列表、操作后总 entry 数
