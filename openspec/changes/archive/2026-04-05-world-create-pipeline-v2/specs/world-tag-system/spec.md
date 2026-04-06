## ADDED Requirements

### Requirement: WorldTagSet 接口
系统 SHALL 定义 `WorldTagSet` 接口，包含 5 个分类维度：`genre`（类型）、`tone`（基调）、`scale`（规模）、`era`（时代）、`theme`（主题）。每个分类的值 SHALL 为 `string[]`。

#### Scenario: WorldTagSet 结构
- **WHEN** 创建一个 WorldTagSet
- **THEN** 包含 genre、tone、scale、era、theme 五个字段，均为 string 数组

### Requirement: WorldTagCategory 类型
系统 SHALL 定义 `WorldTagCategory` 类型：`'genre' | 'tone' | 'scale' | 'era' | 'theme'`。

#### Scenario: WorldTagCategory 完整性
- **WHEN** 导入 `WorldTagCategory`
- **THEN** 可用值为 `'genre' | 'tone' | 'scale' | 'era' | 'theme'`

### Requirement: emptyWorldTagSet
系统 SHALL 提供 `emptyWorldTagSet()` 函数，返回所有分类均为空数组的 WorldTagSet。

#### Scenario: 创建空标签集
- **WHEN** 调用 `emptyWorldTagSet()`
- **THEN** 返回 `{ genre: [], tone: [], scale: [], era: [], theme: [] }`

### Requirement: World Tag 锚点词
系统 SHALL 为每个 WorldTagCategory 提供本地化锚点词列表（通过 `getWorldTagAnchors()` 获取 i18n 翻译），作为 LLM 解析的参考。

#### Scenario: 获取中文锚点词
- **WHEN** 当前语言为 zh，调用 `getWorldTagAnchors()`
- **THEN** 返回的 genre 锚点词包含"赛博朋克"、"奇幻"、"科幻"等；tone 包含"黑暗"、"轻松"、"史诗"等

### Requirement: World Tag LLM 解析
系统 SHALL 复用 `parseTags` 的 LLM 解析逻辑，传入 WorldTagCategory 列表和锚点词，将用户自由文本输入解析为结构化的 WorldTagSet。LLM 返回的 tag 如果不在锚点词列表中 SHALL 保留用户原始输入。

#### Scenario: 解析用户输入的 World Tags
- **WHEN** 用户输入 "赛博朋克 黑暗 城市级 近未来 科技与人性"
- **THEN** LLM 解析后返回 `{ genre: ['赛博朋克'], tone: ['黑暗'], scale: ['城市级'], era: ['近未来'], theme: ['科技与人性'] }`

#### Scenario: 保留非锚点词
- **WHEN** LLM 返回了不在锚点列表中的 tag "蒸汽朋克混合"
- **THEN** 该 tag 被保留在对应 category 中，不会被过滤掉
