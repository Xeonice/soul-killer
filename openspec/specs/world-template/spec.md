## ADDED Requirements

### Requirement: Mustache 子集模板引擎
系统 SHALL 实现轻量模板引擎，支持以下语法：`{{variable}}` 变量插值、`{{#if condition}}...{{/if}}` 条件块、`{{entries.entry-name}}` 条目间引用。不支持 `{{#each}}`、`{{> partial}}` 或复杂表达式。

#### Scenario: 变量插值
- **WHEN** 模板为 `"{{soul.display_name}} 是一名黑客"`，context 中 `soul.display_name` 为 `"V"`
- **THEN** 渲染结果为 `"V 是一名黑客"`

#### Scenario: 嵌套属性访问
- **WHEN** 模板为 `"{{world.display_name}}"`，context 中 `world.display_name` 为 `"夜之城"`
- **THEN** 渲染结果为 `"夜之城"`

#### Scenario: 不存在的变量
- **WHEN** 模板为 `"{{soul.missing_field}}"`，context 中无该字段
- **THEN** 渲染结果为空字符串 `""`

### Requirement: 条件块渲染
`{{#if condition}}` SHALL 在 condition 为 truthy 值时渲染块内容，否则跳过。

#### Scenario: 条件为真
- **WHEN** 模板为 `"{{#if soul.name}}你好{{/if}}"`，`soul.name` 为 `"johnny"`
- **THEN** 渲染结果为 `"你好"`

#### Scenario: 条件为假
- **WHEN** 模板为 `"{{#if soul.missing}}隐藏{{/if}}"`，`soul.missing` 为 undefined
- **THEN** 渲染结果为 `""`

### Requirement: 条目间引用
`{{entries.entry-name}}` SHALL 将已激活条目的渲染后内容插入当前位置。

#### Scenario: 引用另一个条目
- **WHEN** 模板为 `"规则：{{entries.core-rules}}"`，已激活条目 "core-rules" 内容为 "不能杀人"
- **THEN** 渲染结果为 `"规则：不能杀人"`

#### Scenario: 引用未激活的条目
- **WHEN** 模板引用 `{{entries.nonexistent}}`，该条目未激活
- **THEN** 渲染结果中该位置为空字符串

### Requirement: 模板上下文
模板引擎 SHALL 接受 `TemplateContext` 对象，包含 `soul`（name、display_name、identity、tags）、`world`（name、display_name）和 `entries`（Record<string, string>，已激活条目的渲染内容）。

#### Scenario: 完整上下文渲染
- **WHEN** 模板使用 soul、world 和 entries 的多个变量
- **THEN** 所有变量正确替换

### Requirement: 递归深度限制
模板渲染 SHALL 设置最大递归深度为 3 层。当条目 A 引用 B、B 引用 C、C 引用 D 时，D 的内容中的模板标记 SHALL 原样输出不再解析。

#### Scenario: 超过递归深度
- **WHEN** 条目引用链深度达到 4 层
- **THEN** 第 4 层的 `{{...}}` 标记原样保留在输出中
