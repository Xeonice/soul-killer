### Requirement: 创建向导状态机
系统 SHALL 提供重构后的 `WorldCreateWizard` 组件，实现完整的世界创建向导。向导 SHALL 包含以下步骤：type-select → name → name-conflict（条件）→ display-name → description → tags → confirm → capturing（条件：fictional-existing/real）→ search-confirm → search-detail（条件）→ data-sources → source-path → ingesting → distilling → review → creating → bind-prompt（条件：有已加载 Soul）→ done。

#### Scenario: fictional-existing 完整流程
- **WHEN** 用户选择 WorldType 为 `fictional-existing`
- **THEN** 流程经过 type-select → name → display-name → description → tags → confirm → capturing → search-confirm → data-sources → ... → done

#### Scenario: fictional-original 跳过搜索
- **WHEN** 用户选择 WorldType 为 `fictional-original`
- **THEN** 流程跳过 capturing → search-confirm → search-detail，从 confirm 直接到 data-sources

### Requirement: 创建方式选择
向导 SHALL 在 type-select 步骤提供 3 种世界类型选择：已有作品虚构世界（fictional-existing）、原创虚构世界（fictional-original）、真实世界设定（real）。用户通过方向键选择、Enter 确认。

#### Scenario: 选择世界类型
- **WHEN** 用户在 type-select 步骤通过方向键选中 "已有作品虚构世界" 并按 Enter
- **THEN** worldType 设为 `fictional-existing`，流程前进到 name

### Requirement: Tags 输入步骤
向导 SHALL 在 description 之后提供 tags 输入步骤。用户输入自由文本后 SHALL 调用 LLM 解析为 WorldTagSet（genre/tone/scale/era/theme）。Tags 为可选项，用户可直接 Enter 跳过。

#### Scenario: 输入 Tags
- **WHEN** 用户在 tags 步骤输入 "赛博朋克 黑暗 城市级 近未来"
- **THEN** LLM 解析后设置 WorldTagSet，流程前进到 confirm

#### Scenario: 跳过 Tags
- **WHEN** 用户在 tags 步骤直接按 Enter
- **THEN** tags 设为 emptyWorldTagSet()，流程前进到 confirm

### Requirement: AI Agent 搜索
当 WorldType 为 `fictional-existing` 或 `real` 时，确认后 SHALL 进入 capturing 步骤，调用 `captureWorld()` 进行 AI Agent 搜索。搜索过程 SHALL 通过 SoulkillerProtocolPanel（mode='world'）展示实时进度。

#### Scenario: AI 搜索展示
- **WHEN** WorldType 为 `fictional-existing`，用户确认后
- **THEN** 进入 capturing 步骤，渲染 SoulkillerProtocolPanel 展示搜索进度（维度覆盖、tool calls、classification）

### Requirement: 搜索结果确认
AI 搜索完成后 SHALL 进入 search-confirm 步骤，展示搜索摘要（classification、已覆盖维度、chunk 数量）。用户可选择：确认（进入数据源选择）、重试（换关键词重搜）、详情（查看搜索结果详情）。

#### Scenario: 确认搜索结果
- **WHEN** AI 搜索完成且用户选择「确认」
- **THEN** 搜索结果保留，流程进入 data-sources

#### Scenario: 重试搜索
- **WHEN** 用户选择「重试」
- **THEN** 返回 name 步骤重新输入世界名称

### Requirement: 多数据源组合选择
向导 SHALL 提供 CheckboxSelect 多选数据源：web-search（AI 搜索结果，仅在搜索完成后可选）、markdown（本地 Markdown 文件）、url-list（URL 列表抓取）。用户可同时选择多个数据源。

#### Scenario: 组合选择数据源
- **WHEN** 用户勾选 web-search 和 markdown 两个数据源
- **THEN** 先使用搜索结果的 chunks，再收集 markdown 路径并 ingest，合并后蒸馏

#### Scenario: 仅 AI 搜索
- **WHEN** 用户只勾选 web-search
- **THEN** 直接使用搜索结果的 chunks 进入蒸馏

### Requirement: 蒸馏视觉面板
蒸馏过程 SHALL 使用与 capturing 阶段相同的 SoulkillerProtocolPanel 或等价的进度面板展示实时蒸馏进度（phase/progress/维度分类统计）。

#### Scenario: 蒸馏进度展示
- **WHEN** 蒸馏进入 classify 阶段
- **THEN** 面板显示当前阶段、已分类 chunk 数/总数、各维度计数

### Requirement: 创建完成后 Bind 引导
World 创建成功后，如果当前有已加载的 Soul（soulDir 存在），SHALL 进入 bind-prompt 步骤，询问用户是否将新世界绑定到当前 Soul。

#### Scenario: 有 Soul 时引导 Bind
- **WHEN** World 创建完成且 soulDir 存在
- **THEN** 显示 "是否将此世界绑定到当前 Soul？"，用户可选 是/否

#### Scenario: 无 Soul 时跳过 Bind
- **WHEN** World 创建完成但 soulDir 为 undefined
- **THEN** 跳过 bind-prompt，直接进入 done

### Requirement: 名称冲突处理
当输入的世界名称已存在时 SHALL 进入冲突处理步骤，提供两个选项：覆盖（删除现有世界重新创建）、重命名（返回 name 步骤重新输入）。

#### Scenario: 世界名冲突
- **WHEN** 输入世界名 "night-city" 且该名称已存在
- **THEN** 进入 name-conflict 步骤，展示覆盖/重命名选项

### Requirement: 确认摘要
向导 SHALL 在搜索前展示确认摘要，包含：世界名、显示名、描述、世界类型、Tags（如有）。用户可选择「确认」（继续）或「修改」（返回 type-select 步骤）。

#### Scenario: 确认摘要展示
- **WHEN** 用户完成 tags 步骤
- **THEN** 展示包含世界类型、名称、描述、Tags 的确认摘要

### Requirement: supplementWorld prop 外部补充模式入口
WorldCreateWizard SHALL 接受可选的 `supplementWorld?: string` prop。当提供时，SHALL 加载已有世界的 manifest，设置 supplementMode，初始步骤直接跳到 `data-sources`，跳过 type-select/name/display-name/description/tags/confirm。

#### Scenario: 通过 prop 进入补充模式
- **WHEN** 渲染 `<WorldCreateWizard supplementWorld="night-city" />`
- **THEN** 加载 night-city 的 manifest，直接显示数据源选择步骤

#### Scenario: 补充模式完成后追加 entries
- **WHEN** 补充模式完成蒸馏和审查
- **THEN** 新 entries 追加到已有世界，manifest.entry_count 更新
