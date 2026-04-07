# world-dimension-directory Specification

## Purpose
定义世界数据按维度子目录的存储布局规范，包括 `_index.md` 维度总览、`_` 前缀作者视图文件约定，以及集中化的路径解析 API。该规范取代旧版的 `entries/` 顶级目录布局。

## Requirements

### Requirement: 按维度分子目录的世界布局
每个世界 SHALL 在 `~/.soulkiller/worlds/<name>/` 下按维度划分子目录。每个维度一个子目录，目录名使用 `WorldDimension` 的 kebab-case 名称（`geography/`、`history/`、`factions/`、`systems/`、`society/`、`culture/`、`species/`、`figures/`、`atmosphere/`）。普通 entry 作为 `<dimension>/<entry-name>.md` 存放在对应维度目录下。`entries/` 顶级目录 SHALL 不再使用。

#### Scenario: 新建世界的目录结构
- **WHEN** 用户创建世界 "night-city" 并完成 distill
- **THEN** 文件系统 SHALL 包含 `worlds/night-city/<dimension>/` 若干子目录（按 distill 产出的维度）
- **AND** 每个 entry 位于 `worlds/night-city/<dimension>/<entry-name>.md`
- **AND** 不存在 `worlds/night-city/entries/` 目录

#### Scenario: 空维度的目录缺失
- **WHEN** 某维度（如 atmosphere）在 distill 中未产出任何 entry
- **THEN** 对应的 `atmosphere/` 子目录 SHALL 不被创建（不生成空目录）
- **AND** 加载流程正常跳过不存在的维度

### Requirement: 维度归属的存储规则
每个 entry 的 `meta.dimension` 字段 SHALL 决定其存放的维度子目录。`addEntry` 函数 SHALL 根据 `meta.dimension` 将文件写入对应子目录。`meta.dimension` 为 `undefined` 时 SHALL 通过 `inferDimensionFromScope(meta.scope)` 推断一个兜底维度并使用该维度子目录。

#### Scenario: 带 dimension 的 entry 写入
- **WHEN** 调用 `addEntry("night-city", { name: "megacorps", dimension: "factions", ... }, content)`
- **THEN** 创建文件 `worlds/night-city/factions/megacorps.md`

#### Scenario: 缺失 dimension 的兜底
- **WHEN** 调用 `addEntry("night-city", { name: "mood", dimension: undefined, scope: "atmosphere", ... }, content)`
- **THEN** 使用 `inferDimensionFromScope('atmosphere') = 'atmosphere'`
- **AND** 创建文件 `worlds/night-city/atmosphere/mood.md`

### Requirement: `_` 前缀文件约定
文件名以 `_` 开头的 `.md` 文件（如 `_index.md`）SHALL 被视为"作者视图文件"，runtime 的 `loadAllEntries` 和 `ContextAssembler` SHALL 在枚举时跳过所有 `_` 前缀的文件。`_` 前缀文件不参与 entry 集合、不参与 token 预算、不参与注入。

#### Scenario: runtime 跳过 _index.md
- **WHEN** 世界 "night-city" 的 `factions/` 目录下有 `cao-wei-central.md`、`shu-han-court.md` 和 `_index.md` 三个文件
- **THEN** `loadAllEntries("night-city")` 返回 2 个 entry（不含 `_index.md`）
- **AND** ContextAssembler 注入时不包含 `_index.md` 的内容

#### Scenario: 多种 _ 前缀文件
- **WHEN** 维度目录下有 `_index.md`、`_notes.md`、`normal.md`
- **THEN** 只有 `normal.md` 被视为 entry 加载

### Requirement: `_index.md` 维度总览
每个维度子目录在 distill 或 evolve 完成时 SHALL 自动生成 `_index.md` 文件，作为该维度下所有 entry 的总览。`_index.md` SHALL 以表格形式列出 entry 的 name、priority、mode、一句话摘要（取 content 首句或前 80 字符）。`_index.md` 的 frontmatter SHALL 包含 `type: dimension-index`、`dimension: <name>`、`entry_count: <n>`。

#### Scenario: distill 自动生成 _index.md
- **WHEN** distill 完成后某维度写入了 5 个 entry
- **THEN** 该维度目录下 SHALL 存在 `_index.md` 文件
- **AND** `_index.md` 包含 5 行表格条目
- **AND** frontmatter 的 `entry_count` 为 5

#### Scenario: evolve 增量刷新 _index.md
- **WHEN** evolve 向已有 3 个 entry 的 factions 维度增加 2 个新 entry
- **THEN** `factions/_index.md` 被重新生成，包含 5 行
- **AND** 刷新时机在 evolve 的 writeEntries 之后

#### Scenario: 手工编辑后不自动刷新
- **WHEN** 作者手工编辑某 entry 的 content
- **THEN** `_index.md` 不被自动重新生成（保持旧内容）
- **AND** 下次 distill 或 evolve 时才会刷新

### Requirement: 世界根目录可选总览
每个世界的根目录 MAY 包含一个 `_overview.md` 文件，作为作者手写的"全世界总览"。该文件 SHALL 不参与 runtime 装配（`_` 前缀约定），仅作为作者视图。系统 SHALL 不自动生成此文件，由作者自行创建和维护。

#### Scenario: _overview.md 存在
- **WHEN** 世界目录下存在 `_overview.md`
- **THEN** 加载世界 entry 时 SHALL 跳过该文件
- **AND** 作者可通过文件管理器或编辑器直接访问

#### Scenario: _overview.md 不存在
- **WHEN** 世界目录下不存在 `_overview.md`
- **THEN** 系统不报错、不自动创建

### Requirement: 路径解析集中化
系统 SHALL 在 `src/world/entry.ts` 中提供以下路径解析函数，所有需要计算 entry 文件路径的调用方（distill、chronicle、packager、context-assembler）SHALL 通过这些函数获取路径，不得硬编码目录结构：
- `getDimensionDir(worldName: string, dimension: WorldDimension): string`
- `getEntryPath(worldName: string, meta: EntryMeta): string`
- `getHistoryEventsDir(worldName: string): string`
- `getHistoryTimelinePath(worldName: string): string`

#### Scenario: getEntryPath 返回带维度的路径
- **WHEN** 调用 `getEntryPath("night-city", { name: "megacorps", dimension: "factions", ... })`
- **THEN** 返回 `~/.soulkiller/worlds/night-city/factions/megacorps.md`

#### Scenario: getDimensionDir 返回子目录路径
- **WHEN** 调用 `getDimensionDir("night-city", "history")`
- **THEN** 返回 `~/.soulkiller/worlds/night-city/history`
