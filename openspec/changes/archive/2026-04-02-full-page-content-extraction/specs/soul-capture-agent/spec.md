## MODIFIED Requirements

### Requirement: Search results include full page content
After DuckDuckGo search returns URLs, the agent SHALL use the page extractor to fetch full content for the top 3 results, replacing snippets with full Markdown content.

#### Scenario: Full content replaces snippet
- **WHEN** DuckDuckGo returns 5 results with snippets
- **THEN** the top 3 URLs are fetched in parallel using the page extractor
- **AND** results with successfully extracted content use the full content instead of the snippet
- **AND** results where extraction failed keep the original snippet

#### Scenario: Tavily results with short content
- **WHEN** Tavily returns a result with content shorter than 200 characters
- **THEN** the page extractor is triggered for that URL to get full content
