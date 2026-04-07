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
The create command SHALL present a unified data source selection screen after confirm (single mode) or after soul-list confirmation (batch mode). In batch mode, data source selection applies to all souls uniformly.

#### Scenario: Public soul data source selection (single mode)
- **WHEN** a single public soul creation reaches the data-sources step
- **THEN** the screen shows three checkboxes: web search (checked by default), Markdown (unchecked), Twitter Archive (unchecked)

#### Scenario: Personal soul data source selection (single mode)
- **WHEN** a single personal soul creation reaches the data-sources step
- **THEN** the screen shows two checkboxes: Markdown (unchecked), Twitter Archive (unchecked), with no web search option

#### Scenario: Batch mode data source selection
- **WHEN** multiple souls are confirmed in soul-list and proceed to data-sources
- **THEN** the same data source selection screen is shown, and the selection applies to all souls in the batch

#### Scenario: Empty selection skips to distill
- **WHEN** the user submits data-sources with no options selected
- **THEN** the flow proceeds directly to distilling using only synthetic chunks (for each soul in batch mode)

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

### Requirement: Capture result state management
After `captureSoul` returns, `create.tsx` SHALL persist capture result metadata to component state for downstream consumption.

#### Scenario: Web-search capture completes successfully
- **WHEN** `captureSoul` returns with `classification !== 'UNKNOWN_ENTITY'`
- **THEN** SHALL save `result.sessionDir` to `agentSessionDir` state
- **AND** SHALL save `result.dimensionPlan` to `capturedDimensions` state
- **AND** SHALL build `dimBreakdown` from `result.dimensionScores`（每维度 qualifiedCount）
- **AND** SHALL 从 sessionDir 重算 `chunkCount`（读取所有 .json 文件的 results.length 之和）

#### Scenario: Capture returns UNKNOWN_ENTITY
- **WHEN** `captureSoul` returns with `classification === 'UNKNOWN_ENTITY'`
- **THEN** SHALL 不保存 sessionDir 等数据
- **AND** SHALL 按现有逻辑进入 unknown 流程

### Requirement: Distill 调用路径分流
`create.tsx` SHALL 根据数据来源选择 distill 路径。

#### Scenario: Web-search 路径调用 distill
- **WHEN** 进入 distill 且 `agentSessionDir` 可用
- **THEN** SHALL 调用 `distillSoul(name, soulDir, config, { sessionDir: agentSessionDir, tags, onProgress, agentLog })`
- **AND** SHALL 不传 chunks 参数

#### Scenario: Local source 路径调用 distill
- **WHEN** 进入 distill 且无 `agentSessionDir`（仅有 local source）
- **THEN** SHALL 调用 `distillSoul(name, soulDir, config, { chunks: allChunks, tags, onProgress, agentLog })`
- **AND** allChunks 由 appendChunks + syntheticChunks + ingest chunks 组成

#### Scenario: 混合路径（web-search + local source）
- **WHEN** web-search 和 local source 都有数据
- **THEN** SHALL 将 local source chunks 转为补充维度写入 sessionDir
- **OR** SHALL 传入 sessionDir 同时附加 chunks（distillSoul 合并两路数据）

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

### Requirement: Soul-list step for managing multiple souls
After the user enters the first soul's name and description, the create command SHALL display a `soul-list` step showing all added souls with options to add another, continue, or remove the last one.

#### Scenario: First soul added
- **WHEN** the user completes name + description for the first soul
- **THEN** the soul-list shows 1 entry and options: [+] 添加另一个 Soul, [→] 继续

#### Scenario: Add another soul
- **WHEN** the user selects [+] in soul-list
- **THEN** the wizard returns to the name input step, and upon completion returns to soul-list with the new soul appended

#### Scenario: Remove last soul
- **WHEN** the user selects [✕] 移除最后一个 with 2+ souls in the list
- **THEN** the last soul is removed and soul-list refreshes

#### Scenario: Remove last soul when only one exists
- **WHEN** the user selects [✕] with only 1 soul in the list
- **THEN** the option is not available (hidden or disabled)

#### Scenario: Continue with single soul
- **WHEN** the user selects [→] 继续 with exactly 1 soul in the list
- **THEN** the wizard proceeds through the original single-soul flow (tags → confirm → data-sources → ...)

#### Scenario: Continue with multiple souls
- **WHEN** the user selects [→] 继续 with 2+ souls in the list
- **THEN** the wizard skips tags input and proceeds to data-sources → batch-capturing → batch-summary

### Requirement: Batch mode skips manual tags input
In batch mode (multiple souls), the tags step SHALL be skipped entirely. Tags SHALL be automatically inferred by the distill agent from captured content.

#### Scenario: Two souls proceed to batch
- **WHEN** the user continues from soul-list with 2 souls
- **THEN** the flow goes directly to data-sources without asking for tags for any soul

### Requirement: Batch mode skips search-confirm
In batch mode, the search-confirm step SHALL be skipped. After capture completes for a soul, it SHALL automatically proceed to distill.

#### Scenario: Soul capture completes in batch
- **WHEN** Soul A's capture finishes during batch execution
- **THEN** Soul A's distill begins immediately without user confirmation

### Requirement: Batch capturing step shows BatchProtocolPanel
During batch execution, the create command SHALL render `BatchProtocolPanel` instead of `SoulkillerProtocolPanel`, passing per-soul progress data.

#### Scenario: Batch execution begins
- **WHEN** 3 souls start batch execution
- **THEN** the view shows `BatchProtocolPanel` with 3 soul entries in compact mode

### Requirement: Batch summary step after all souls complete
After all souls in the batch finish (success or failure), the create command SHALL transition to `batch-summary` step showing results and action menu.

#### Scenario: Batch summary with retry option
- **WHEN** 2 souls succeed and 1 fails
- **THEN** the summary shows results and menu with 完成, 重试失败的, 查看详情

#### Scenario: Retry from summary
- **WHEN** the user selects "重试失败的" in batch summary
- **THEN** the failed souls are re-executed through the batch pipeline and the view returns to batch-capturing

#### Scenario: Complete from summary
- **WHEN** the user selects "完成" in batch summary
- **THEN** `onComplete` is called for each successful soul and the command exits

### Requirement: Command registry entries
The command registry SHALL include entries for all available commands including `pack` and `unpack`.

#### Scenario: Pack command registered
- **WHEN** the command registry is loaded
- **THEN** it contains a `pack` command with description and group

#### Scenario: Unpack command registered
- **WHEN** the command registry is loaded
- **THEN** it contains an `unpack` command with description and group
