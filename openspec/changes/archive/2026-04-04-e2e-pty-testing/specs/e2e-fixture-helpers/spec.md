## ADDED Requirements

### Requirement: createTestHome creates isolated environment
`createTestHome(opts?)` SHALL create a temporary directory, write `~/.soulkiller/config.yaml` with animation: false and a test API key, and return `{ homeDir, configPath, soulsDir, cleanup }`.

#### Scenario: Default test home
- **WHEN** createTestHome() is called
- **THEN** a temp directory is created with config.yaml (animation: false, api_key: 'test-key', default_model: 'test/model')

#### Scenario: With mock server URL
- **WHEN** createTestHome({ mockServerUrl: 'http://localhost:9999' }) is called
- **THEN** config.yaml is written AND the mockServerUrl is available for TestTerminal to use as SOULKILLER_API_URL

#### Scenario: Cleanup removes temp directory
- **WHEN** cleanup() is called
- **THEN** the entire temp directory is recursively removed

### Requirement: createBareSoul creates directory skeleton
`createBareSoul(homeDir, name, opts?)` SHALL call `packageSoul()` and `generateManifest()` to create a soul with directory structure but no identity/style files.

#### Scenario: Bare soul structure
- **WHEN** createBareSoul(homeDir, 'alice') is called
- **THEN** `<homeDir>/.soulkiller/souls/alice/` exists with manifest.json, soul/, soul/behaviors/, vectors/, examples/ directories

#### Scenario: Custom soul type
- **WHEN** createBareSoul(homeDir, 'alice', { soulType: 'personal' }) is called
- **THEN** manifest.json contains soulType: 'personal'

### Requirement: createDistilledSoul creates chat-ready soul
`createDistilledSoul(homeDir, name, persona?)` SHALL call createBareSoul then `generateSoulFiles()` to create identity.md, style.md, and behaviors.

#### Scenario: Default persona
- **WHEN** createDistilledSoul(homeDir, 'alice') is called with no persona
- **THEN** soul/identity.md, soul/style.md, soul/behaviors/default.md all exist with default content

#### Scenario: Custom persona
- **WHEN** createDistilledSoul(homeDir, 'alice', { identity: 'A hacker', style: 'Cryptic' }) is called
- **THEN** identity.md contains 'A hacker' and style.md contains 'Cryptic'

#### Scenario: loadSoulFiles succeeds
- **WHEN** createDistilledSoul creates a soul and loadSoulFiles() is called on that directory
- **THEN** loadSoulFiles returns non-null with identity, style, and behaviors

### Requirement: createEvolvedSoul creates recall-ready soul
`createEvolvedSoul(homeDir, name, opts?)` SHALL call createDistilledSoul, then ingest chunks via LocalEngine and write evolve history via `appendEvolveEntry()`.

#### Scenario: Default chunks
- **WHEN** createEvolvedSoul(homeDir, 'alice') is called with no chunks
- **THEN** chunks.json exists with built-in fixture chunks, manifest.chunk_count > 0, and evolve_history has one entry

#### Scenario: Custom chunks
- **WHEN** createEvolvedSoul(homeDir, 'alice', { chunks: customChunks }) is called
- **THEN** chunks.json contains exactly customChunks, manifest.chunk_count equals customChunks.length

#### Scenario: Recall works after fixture creation
- **WHEN** createEvolvedSoul creates a soul and LocalEngine.recall() is called with a keyword from the chunks
- **THEN** recall returns matching results
