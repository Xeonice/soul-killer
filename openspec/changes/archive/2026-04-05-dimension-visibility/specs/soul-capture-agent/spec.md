## MODIFIED Requirements

### Requirement: Agent emits search plan progress event
The `captureSoul` function SHALL emit a `search_plan` progress event when the `planSearch` tool completes, containing the dimension list with priorities.

#### Scenario: planSearch result triggers event
- **WHEN** the planSearch tool returns a result with 6 dimensions
- **THEN** `onProgress` is called with `{ type: 'search_plan', dimensions: [{ dimension, priority }...] }`
