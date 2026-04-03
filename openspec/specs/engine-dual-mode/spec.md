# Dual-Mode Engine Abstraction

Dual-mode engine abstraction providing a unified EngineAdapter interface, Docker-based engine, local in-process engine, auto-detection at startup, silent container management, transparent switching, and status display.

## ADDED Requirements

### Requirement: EngineAdapter Interface

The system SHALL define an `EngineAdapter` interface that all engine implementations MUST conform to. The interface MUST expose the following methods: `ingest(chunks: SoulChunk[]): Promise<IngestResult>` for ingesting data chunks into the vector store, `recall(query: string, opts?: RecallOptions): Promise<SoulChunk[]>` for retrieving relevant chunks by semantic similarity, `distill(config: DistillConfig): Promise<SoulFiles>` for generating distilled soul files, and `status(): Promise<EngineStatus>` for reporting engine health and statistics. All REPL and pipeline code MUST interact with the engine exclusively through this interface.

#### Scenario: Ingest Via Interface

- WHEN the pipeline orchestrator calls `engine.ingest(chunks)` with 100 SoulChunks
- THEN the active engine implementation processes the chunks
- THEN an `IngestResult` is returned containing the count of chunks ingested and any errors

#### Scenario: Recall Via Interface

- WHEN the conversation engine calls `engine.recall("consciousness", { topK: 5 })`
- THEN the active engine returns up to 5 SoulChunks ranked by semantic similarity
- THEN each chunk includes its similarity score

#### Scenario: Status Via Interface

- WHEN any component calls `engine.status()`
- THEN the engine returns an `EngineStatus` with mode ("docker" or "local"), chunk count, index size, and health status

### Requirement: Docker Engine

The system SHALL provide a Docker-based engine implementation that runs a Python + FastAPI server on port 6600. The Docker engine MUST use BGE-M3 for text embedding and LanceDB for vector storage. The Docker engine MUST expose HTTP API endpoints for `/ingest` (POST), `/recall` (POST), `/distill` (POST), and `/status` (GET). All data MUST be persisted to a Docker volume mapped to `~/.soulkiller/data/`.

#### Scenario: Ingest Via Docker Engine

- WHEN the Docker engine receives an ingest request with 50 chunks
- THEN the FastAPI server embeds each chunk using BGE-M3
- THEN embeddings and chunk data are stored in LanceDB
- THEN the response returns `{ ingested: 50, errors: [] }`

#### Scenario: Recall Via Docker Engine

- WHEN the Docker engine receives a recall request for query "what do I think about free will"
- THEN the query is embedded using BGE-M3
- THEN LanceDB performs a vector similarity search
- THEN the top-K matching chunks are returned with similarity scores

#### Scenario: Status Endpoint

- WHEN a GET request is made to `http://localhost:6600/status`
- THEN the response includes `{ mode: "docker", chunks: 1234, indexSize: "45MB", health: "ok" }`

### Requirement: Local Engine

The system SHALL provide a local in-process engine implementation that runs entirely within the Node.js process. The local engine MUST use `@xenova/transformers` for BGE-M3 ONNX embedding. The local engine MUST use `@lancedb/lancedb` for vector storage. Data MUST be persisted to `~/.soulkiller/data/local/`. The local engine MUST function identically to the Docker engine from the EngineAdapter interface perspective.

#### Scenario: Ingest Via Local Engine

- WHEN the local engine's `ingest()` is called with 50 chunks
- THEN `@xenova/transformers` loads the BGE-M3 ONNX model and computes embeddings in-process
- THEN embeddings and chunk data are stored in the local LanceDB instance
- THEN the result returns `{ ingested: 50, errors: [] }`

#### Scenario: First-Time Model Download

- WHEN the local engine is used for the first time and the ONNX model is not cached
- THEN `@xenova/transformers` downloads the BGE-M3 model
- THEN a progress indicator is displayed during download
- THEN subsequent uses load from cache without downloading

### Requirement: Auto-Detection at Startup

The system SHALL automatically detect the available engine mode at startup. The detection sequence MUST be: (1) check if Docker daemon is running, (2) if yes, check if the `soulkiller-engine` container exists and is running, (3) if Docker is available, use DockerEngine, (4) otherwise fall back to LocalEngine. The detection result MUST be logged during boot animation Phase 3.

#### Scenario: Docker Available With Running Container

- WHEN the REPL starts and Docker daemon is running and `soulkiller-engine` container is active
- THEN the system selects DockerEngine
- THEN boot Phase 3 displays "Engine: Docker (port 6600)"

#### Scenario: Docker Not Available

- WHEN the REPL starts and Docker daemon is not running or not installed
- THEN the system falls back to LocalEngine
- THEN boot Phase 3 displays "Engine: Local (in-process)"

#### Scenario: Docker Available But No Container

- WHEN the REPL starts and Docker daemon is running but no `soulkiller-engine` container exists
- THEN the system triggers silent container management (see next requirement)

### Requirement: Silent Container Management

The system SHALL automatically manage the Docker container lifecycle when Docker is available but the `soulkiller-engine` container is not running. The system MUST pull the `soulkiller-engine` image if not present locally. The system MUST start the container with appropriate port mapping (6600) and volume mount (`~/.soulkiller/data/`). All container management operations MUST run silently in the background with only a brief status message shown to the user. The system MUST NOT prompt the user for confirmation.

#### Scenario: Auto-Pull and Start

- WHEN Docker is available but the `soulkiller-engine` image is not pulled
- THEN the system pulls the image silently (showing "Pulling soulkiller-engine..." status)
- THEN the system starts the container with `-p 6600:6600 -v ~/.soulkiller/data:/data`
- THEN the system waits for the `/status` endpoint to respond healthy
- THEN DockerEngine is selected

#### Scenario: Container Exists But Stopped

- WHEN the `soulkiller-engine` container exists but is stopped
- THEN the system starts the existing container
- THEN the system waits for healthy status
- THEN DockerEngine is selected

### Requirement: Transparent Switching

The system SHALL ensure that the REPL layer, command handlers, and conversation engine NEVER directly reference Docker or Local engine specifics. All engine interactions MUST go through the `EngineAdapter` interface exclusively. Switching between engine modes MUST NOT require any changes to REPL-layer code.

#### Scenario: Conversation Works Identically on Both Engines

- WHEN the user asks "what do I think about AI?" on a Docker engine session
- THEN the recall and response flow works through EngineAdapter
- WHEN the same query is run on a Local engine session
- THEN the recall and response flow is functionally identical
- THEN the user cannot distinguish which engine mode is active from the conversation quality

#### Scenario: Ingest Works Identically on Both Engines

- WHEN the user runs `/ingest` on a Docker engine session
- THEN chunks are ingested via `engine.ingest()`
- WHEN the same operation runs on a Local engine session
- THEN the behavior is identical from the user's perspective

### Requirement: Status Display

The `/status` command SHALL display the current engine status. The display MUST include: engine mode (docker or local), total chunk count in the vector store, index size on disk, and engine health. The display MUST use the cyberpunk visual styling (cyan borders, themed labels).

#### Scenario: Status With Docker Engine

- WHEN the user types `/status` and DockerEngine is active
- THEN the display shows "Mode: Docker (port 6600)", "Chunks: 1,234", "Index: 45 MB", "Health: OK"
- THEN the output is rendered with cyberpunk-themed styling

#### Scenario: Status With Local Engine

- WHEN the user types `/status` and LocalEngine is active
- THEN the display shows "Mode: Local (in-process)", "Chunks: 1,234", "Index: 45 MB", "Health: OK"

#### Scenario: Status With No Data

- WHEN the user types `/status` before any ingestion
- THEN the display shows "Chunks: 0", "Index: 0 MB"
- THEN a hint is displayed: "Use /ingest to load your soul data"
