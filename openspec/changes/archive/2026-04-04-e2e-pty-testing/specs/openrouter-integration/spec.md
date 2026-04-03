## MODIFIED Requirements

### Requirement: LLM client supports configurable base URL
LLM client SHALL use `SOULKILLER_API_URL` environment variable as baseURL when set, falling back to `https://openrouter.ai/api/v1` when not set.

#### Scenario: Default base URL
- **WHEN** SOULKILLER_API_URL is not set
- **THEN** client uses `https://openrouter.ai/api/v1`

#### Scenario: Custom base URL via environment variable
- **WHEN** SOULKILLER_API_URL is set to 'http://localhost:9999/v1'
- **THEN** client uses 'http://localhost:9999/v1' as baseURL
