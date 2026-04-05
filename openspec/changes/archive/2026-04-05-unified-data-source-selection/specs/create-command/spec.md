## MODIFIED Requirements

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
