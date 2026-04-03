# Soul Conversation

## ADDED Requirements

### Requirement: Conversation Flow

The system SHALL implement the following conversation pipeline: user types natural language in the REPL, the system performs RAG recall from the vector store, constructs a prompt combining soul files (identity.md + style.md + the most relevant behavior file) with retrieved chunks and the user query, sends the prompt to the LLM via OpenRouter, and streams the response to the terminal.

#### Scenario: Standard conversation turn

- WHEN the user types a natural language message in the REPL
- THEN the system SHALL query the vector store for relevant chunks
- AND construct a prompt that includes identity.md, style.md, the best-matching behavior file, retrieved chunks, and the user query
- AND send the prompt to the LLM via OpenRouter
- AND stream the LLM response token-by-token to the terminal

#### Scenario: No soul files exist yet

- WHEN the user types a message
- AND no soul files have been generated
- THEN the system SHALL still perform RAG recall and generate a response using retrieved chunks only
- AND display a warning suggesting the user run `/distill` to improve response quality

### Requirement: SOUL_RECALL Animation

Before each response, the system SHALL display a recall panel showing the scanned memories, including file paths, similarity scores, and total retrieval time. The panel MUST auto-collapse after display, then streaming of the LLM response SHALL begin.

#### Scenario: Recall panel display during conversation

- WHEN the system completes RAG recall for a user query
- THEN the system SHALL display a styled recall panel showing:
  - Number of memories scanned
  - Top-k retrieved chunks with file paths and similarity scores
  - Total retrieval time in milliseconds
- AND the panel SHALL auto-collapse after 1-2 seconds
- AND then the LLM response stream SHALL begin

#### Scenario: Recall finds no relevant results

- WHEN the system completes RAG recall
- AND no chunks meet the similarity threshold
- THEN the recall panel SHALL display "0 memories matched" with the retrieval time
- AND the panel SHALL still auto-collapse before the response begins

### Requirement: /source Command

The system SHALL provide a `/source` command that re-displays the recall results from the last response, showing memory sources with their similarity scores.

#### Scenario: User requests sources after a response

- WHEN the user enters `/source`
- AND a previous conversation turn exists
- THEN the system SHALL display the full recall results from the last response, including file paths, chunk previews, and similarity scores

#### Scenario: /source with no prior conversation

- WHEN the user enters `/source`
- AND no prior conversation turn exists in the session
- THEN the system SHALL display a message indicating no prior recall results are available

### Requirement: Soul Self-Identification

The soul MUST identify as an AI reconstruction (not the original person) in the first conversation turn of each session and when making important recommendations or decisions.

#### Scenario: First message in a session

- WHEN the user sends the first message in a new session
- THEN the soul's response MUST include a clear statement that it is an AI reconstruction based on digital traces, not the original person

#### Scenario: Important recommendation

- WHEN the soul is asked for advice on a significant decision (career, financial, health, relationship)
- THEN the response MUST include a reminder that it is an AI reconstruction and its recommendations should be weighed accordingly

### Requirement: Boundary Awareness

When no relevant data is found in the vector store for a given query, the soul MUST explicitly state that it does not have information about the topic rather than fabricating an answer.

#### Scenario: Query with no matching data

- WHEN the user asks a question
- AND the vector store returns no chunks above the similarity threshold
- THEN the soul SHALL respond with a statement like "I don't have information about this" or equivalent
- AND SHALL NOT fabricate or hallucinate an answer

#### Scenario: Partial data available

- WHEN the user asks a question
- AND the vector store returns some relevant chunks but they do not fully address the query
- THEN the soul SHALL answer based on available data
- AND explicitly note which aspects it cannot address due to insufficient data

### Requirement: Source Attribution

Responses that reference specific memories from the vector store MUST include source attribution with the file path and date (if available).

#### Scenario: Response referencing specific memories

- WHEN the LLM generates a response that draws from specific retrieved chunks
- THEN the response MUST include inline or footnote-style source attribution
- AND each attribution SHALL include the source file path and date (if the chunk metadata contains a date)

#### Scenario: Response based on general soul personality

- WHEN the LLM generates a response based on general soul traits (from identity.md/style.md) rather than specific chunks
- THEN source attribution is NOT required

### Requirement: /recall Command

The system SHALL provide a `/recall <query>` command that performs a manual RAG test, displaying the top-k results with similarity scores without generating an LLM response.

#### Scenario: Manual recall test

- WHEN the user enters `/recall what do I think about testing`
- THEN the system SHALL query the vector store with the provided query
- AND display the top-k results with chunk content previews, source file paths, and similarity scores
- AND SHALL NOT send anything to the LLM

#### Scenario: Recall with no results

- WHEN the user enters `/recall <query>`
- AND no chunks meet the similarity threshold
- THEN the system SHALL display a message indicating no relevant memories were found for the query
