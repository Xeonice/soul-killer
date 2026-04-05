## ADDED Requirements

### Requirement: Entry 文件格式
每个世界条目 SHALL 是一个 `.md` 文件，位于 `entries/` 目录下，使用 YAML frontmatter 描述元数据。Frontmatter SHALL 包含：`name`（string）、`keywords`（string[]）、`priority`（number, 0-1000）、`mode`（`"always"` | `"keyword"` | `"semantic"`）、`scope`（`"background"` | `"rule"` | `"lore"` | `"atmosphere"`）。

#### Scenario: 解析 keyword 模式条目
- **WHEN** 读取包含 `mode: keyword` 和 `keywords: ["荒坂", "Arasaka"]` frontmatter 的 entry 文件
- **THEN** 解析结果包含 `mode: "keyword"`，`keywords` 为 `["荒坂", "Arasaka"]`，body 为 frontmatter 之后的 markdown 内容

#### Scenario: 解析 always 模式条目
- **WHEN** 读取包含 `mode: always` frontmatter 的 entry 文件
- **THEN** 解析结果中 `keywords` 可以为空数组，条目始终被激活

### Requirement: Frontmatter 解析器
系统 SHALL 实现自定义 frontmatter 解析器（基于 `---` 分隔符），支持 string、number、string array 类型的 YAML 值。不依赖外部 frontmatter 解析库。

#### Scenario: 解析简单 frontmatter
- **WHEN** 输入文本以 `---\n` 开头、以 `\n---\n` 结束 frontmatter 区域
- **THEN** 正确解析 frontmatter 为键值对，剩余内容作为 body 返回

#### Scenario: 无 frontmatter 的文件
- **WHEN** 输入文本不以 `---` 开头
- **THEN** 整个内容作为 body，frontmatter 为空对象

### Requirement: Entry CRUD 操作
系统 SHALL 提供 `addEntry`、`loadEntry`、`loadAllEntries`、`removeEntry`、`updateEntry` 函数操作世界条目。

#### Scenario: 添加条目
- **WHEN** 调用 `addEntry(worldName, { name: "megacorps", mode: "keyword", ... }, content)`
- **THEN** 创建文件 `~/.soulkiller/worlds/<worldName>/entries/megacorps.md`，包含正确的 frontmatter 和 content

#### Scenario: 加载所有条目
- **WHEN** 世界 "night-city" 的 `entries/` 目录下有 3 个 `.md` 文件
- **THEN** `loadAllEntries("night-city")` 返回 3 个解析后的 Entry 对象

### Requirement: Entry scope 分类
条目的 `scope` 字段 SHALL 决定其在 context 中的语义角色：`background`（世界背景，注入靠前位置）、`rule`（世界规则/约束）、`lore`（知识条目，按需召回）、`atmosphere`（氛围暗示，影响回复风格）。

#### Scenario: 不同 scope 的注入位置
- **WHEN** context assembler 处理条目时
- **THEN** `background` 和 `rule` scope 的条目放在 soul files 之前，`lore` 和 `atmosphere` scope 的条目放在 soul files 之后
