## ADDED Requirements

### Requirement: Entry dimension 字段
EntryMeta SHALL 包含可选的 `dimension?: WorldDimension` 字段。该字段用于语义分类，与 `scope`（注入行为）解耦。旧 entry 没有此字段时 dimension 为 `undefined`。

#### Scenario: 带 dimension 的 entry frontmatter
- **WHEN** 读取包含 `dimension: geography` frontmatter 的 entry 文件
- **THEN** 解析结果的 meta 包含 `dimension: 'geography'`

#### Scenario: 不带 dimension 的旧 entry
- **WHEN** 读取不包含 `dimension` 字段的旧 entry 文件
- **THEN** 解析结果的 meta.dimension 为 `undefined`

#### Scenario: dimension 写入 frontmatter
- **WHEN** 调用 `addEntry(worldName, { ...meta, dimension: 'systems' }, content)`
- **THEN** 生成的 .md 文件 frontmatter 包含 `dimension: systems`

## MODIFIED Requirements

### Requirement: Entry 文件格式
每个世界条目 SHALL 是一个 `.md` 文件，位于 `entries/` 目录下，使用 YAML frontmatter 描述元数据。Frontmatter SHALL 包含：`name`（string）、`keywords`（string[]）、`priority`（number, 0-1000）��`mode`（`"always"` | `"keyword"` | `"semantic"`）、`scope`（`"background"` | `"rule"` | `"lore"` | `"atmosphere"`）。Frontmatter MAY 包含可选字段 `dimension`（WorldDimension string）。

#### Scenario: 解析 keyword 模式条目
- **WHEN** 读取包含 `mode: keyword` 和 `keywords: ["荒坂", "Arasaka"]` frontmatter 的 entry 文件
- **THEN** 解析结果包含 `mode: "keyword"`，`keywords` 为 `["荒坂", "Arasaka"]`，body 为 frontmatter 之后的 markdown 内容

#### Scenario: 解析带 dimension 的条目
- **WHEN** 读取包含 `dimension: geography` 的 entry 文件
- **THEN** 解析结果包含 `dimension: 'geography'`，其他字段正常解析
