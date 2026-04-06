## MODIFIED Requirements

### Requirement: Error state keyboard handling
The create command SHALL handle keyboard input in the `error` step: Esc to return to REPL, up/down arrows to navigate menu, Enter to confirm selection.

#### Scenario: Esc returns to REPL
- **WHEN** the user is on the error screen and presses Esc
- **THEN** `onCancel()` is called and the user returns to the REPL

#### Scenario: Enter on retry option
- **WHEN** the user selects "retry" and presses Enter
- **THEN** agent state is reset (toolCalls, classification, origin, chunks, protocolPhase) and the create flow restarts from capturing (public) or data-sources (personal)

#### Scenario: Enter on return option
- **WHEN** the user selects "return to REPL" and presses Enter
- **THEN** `onCancel()` is called

### Requirement: Error screen shows retry menu
The error screen SHALL display the error message and a two-option menu (retry / return to REPL) instead of a text-only hint.

#### Scenario: Error menu displayed
- **WHEN** an error occurs during create flow
- **THEN** the error screen shows the error message and two selectable options: retry and return to REPL

#### Scenario: User inputs preserved on retry
- **WHEN** the user retries after an error
- **THEN** soulName, soulType, description, and hint are preserved from the original attempt

---

### Requirement: Search confirm shows dimension coverage
The search-confirm screen SHALL display a dimension coverage histogram below the fragment count, computed from `agentChunks[].metadata.extraction_step`.

#### Scenario: Coverage histogram displayed
- **WHEN** the search-confirm screen is shown with 47 chunks
- **THEN** a dimension coverage section lists all 6 dimensions with proportional bars and counts

### Requirement: Search detail shows dimension labels
The search-detail screen SHALL display the dimension label for each chunk alongside the source.

#### Scenario: Dimension tag on chunk
- **WHEN** a chunk has `metadata.extraction_step = 'quotes'`
- **THEN** the chunk line shows "web · quotes" before the URL

#### Scenario: No dimension metadata
- **WHEN** a chunk has no `metadata.extraction_step`
- **THEN** no dimension label is shown (only source)

### Requirement: Data source selection is unified entry point after confirm
The create command SHALL present a unified data source selection screen after confirm, regardless of soul type. For public souls, the options SHALL include web search (default checked), Markdown, and Twitter Archive. For personal souls, the options SHALL include only Markdown and Twitter Archive.

#### Scenario: Public soul data source selection
- **WHEN** a public soul creation reaches the data-sources step
- **THEN** the screen shows three checkboxes: web search (checked by default), Markdown (unchecked), Twitter Archive (unchecked)

#### Scenario: Personal soul data source selection
- **WHEN** a personal soul creation reaches the data-sources step
- **THEN** the screen shows two checkboxes: Markdown (unchecked), Twitter Archive (unchecked), with no web search option

#### Scenario: Empty selection skips to distill
- **WHEN** the user submits data-sources with no options selected
- **THEN** the flow proceeds directly to distilling using only synthetic chunks

### Requirement: Selected data sources execute in order
The create command SHALL execute selected data sources sequentially: web search first (if selected), then local sources (Markdown/Twitter) in selection order.

#### Scenario: Web search + Markdown selected
- **WHEN** the user selects both web search and Markdown
- **THEN** the flow runs capturing → search-confirm → source-path (Markdown) → ingesting → distilling

#### Scenario: Only Markdown selected for public soul
- **WHEN** a public soul user unchecks web search and selects only Markdown
- **THEN** the flow skips capturing entirely and runs source-path → ingesting → distilling

### Requirement: Search confirm no longer offers supplement option
After data source selection is moved before capturing, the search-confirm menu SHALL remove the "supplement data source" option since data sources are already chosen.

#### Scenario: Search confirm menu
- **WHEN** the search-confirm screen is shown
- **THEN** the menu contains: confirm, detail, retry (no supplement option)

### Requirement: Distill step uses agent-driven distillation
The create command's `startDistill` function SHALL call `distillSoul` (agent-driven) instead of `extractFeatures` (fixed pipeline). Soul files are written by the agent's tools, so `generateSoulFiles` is no longer called separately.

#### Scenario: Create flow distill step
- **WHEN** distillation starts in the create flow
- **THEN** `distillSoul(name, chunks, soulDir, config, tags, onProgress, agentLog)` is called and the agent writes files via tools

### Requirement: Distill panel shows dynamic tool calls
The distillation UI SHALL display a dynamic list of agent tool calls with status indicators, replacing the fixed 5-phase progress panel.

#### Scenario: Dynamic distill panel
- **WHEN** the agent calls sampleChunks, writeIdentity, reviewSoul in sequence
- **THEN** each tool call appears as a line item with icon, name, result summary, and done/spinner indicator

### Requirement: supplementSoul prop 外部补充模式入口
CreateCommand SHALL 接受可选的 `supplementSoul?: { name: string; dir: string }` prop。当提供时，SHALL 加载已有 Soul 的 manifest（soulType/tags/description），初始步骤直接跳到 `data-sources`，跳过 type-select/name/description/tags/confirm/name-conflict。

#### Scenario: 通过 prop 进入补充模式
- **WHEN** 渲染 `<CreateCommand supplementSoul={{ name: 'alice', dir: '/path/to/alice' }} />`
- **THEN** 加载 alice 的 manifest，直接显示数据源选择步骤

### Requirement: 补充模式蒸馏增加 merge 逻辑
CreateCommand 在补充模式下，蒸馏完成后 SHALL 执行 merge 步骤：创建 snapshot → 提取 delta features → 与现有 soul files 合并 → 写入合并结果 → 记录 evolve history。

#### Scenario: 补充模式 merge 已有 Soul
- **WHEN** 补充模式蒸馏完成
- **THEN** 创建快照，提取新 features，与已有 identity.md/style.md/behaviors 合并，写入合并结果

#### Scenario: 补充模式记录进化历史
- **WHEN** 补充模式 merge 完成
- **THEN** manifest.evolve_history 追加一条记录
