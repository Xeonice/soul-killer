## ADDED Requirements

### Requirement: Mock server implements OpenAI chat completions endpoint
Mock LLM Server SHALL listen on a configurable port and handle `POST /v1/chat/completions` with OpenAI-compatible SSE streaming response.

#### Scenario: Stream response
- **WHEN** a POST request with `stream: true` is sent to `/v1/chat/completions`
- **THEN** server responds with `Content-Type: text/event-stream` and sends SSE chunks in format `data: {"choices":[{"delta":{"content":"..."}}]}` followed by `data: [DONE]`

#### Scenario: Default fixed response
- **WHEN** no custom response is configured
- **THEN** server returns a fixed response text split into SSE chunks

### Requirement: Mock server records requests
Mock server SHALL record all received requests for later assertion.

#### Scenario: Assert request count
- **WHEN** two chat completion requests are sent
- **THEN** server.requests.length equals 2

#### Scenario: Assert conversation context
- **WHEN** second request is sent after first round of conversation
- **THEN** second request's messages array contains system + user1 + assistant1 + user2 (context accumulated)

### Requirement: Mock server lifecycle management
Mock server SHALL provide `start()` and `stop()` methods for test setup/teardown.

#### Scenario: Start and stop
- **WHEN** start() is called
- **THEN** server listens on the configured port and returns the URL
- **WHEN** stop() is called
- **THEN** server closes all connections and releases the port
