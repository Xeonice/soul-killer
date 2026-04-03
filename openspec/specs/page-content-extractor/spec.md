## ADDED Requirements

### Requirement: Extract full page content from URL
The page extractor SHALL fetch a URL, parse the HTML, extract the main article content using readability, and convert it to Markdown using turndown.

#### Scenario: Wiki page extraction
- **WHEN** given a Fandom Wiki URL like "https://cyberpunk.fandom.com/wiki/Johnny_Silverhand"
- **THEN** it returns clean Markdown text containing the character description, background, and details
- **AND** navigation, sidebars, ads, and footer content are excluded

#### Scenario: Content length limit
- **WHEN** the extracted content exceeds 3000 characters
- **THEN** the output is truncated to 3000 characters

#### Scenario: Non-HTML content skipped
- **WHEN** the URL returns non-HTML content (PDF, image, etc.)
- **THEN** the extractor returns null without error

#### Scenario: Timeout handling
- **WHEN** the page takes longer than 5 seconds to fetch
- **THEN** the extractor returns null without blocking the agent

#### Scenario: Fetch failure fallback
- **WHEN** the page returns 403/404/500 or fetch fails
- **THEN** the extractor returns null and the original search snippet is used instead

#### Scenario: Parallel extraction with partial failure
- **WHEN** extracting 3 URLs in parallel and 1 fails
- **THEN** the 2 successful results contain content and the failed one contains null

#### Scenario: Search enrichment replaces snippet
- **WHEN** DuckDuckGo returns a URL with a short snippet
- **THEN** the web-search tool fetches the full page content and replaces the snippet
- **AND** if the page fetch fails, the original snippet is preserved
