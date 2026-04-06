# Soul Package Format and Distribution


### Requirement: Package Structure

A soul package MUST conform to the following directory structure: `manifest.json` at the root, `soul/` containing `identity.md`, `style.md`, and `behaviors/` directory, `vectors/` containing `index.lance/` and `config.json`, `examples/` containing `good.jsonl` and `bad.jsonl`, and a `SOUL.md` readme file.

#### Scenario: Valid soul package contents

- WHEN a soul package is created or validated
- THEN it MUST contain the following structure:
  - `manifest.json` — package metadata
  - `soul/identity.md` — identity traits
  - `soul/style.md` — style traits
  - `soul/behaviors/` — one or more behavior files
  - `vectors/index.lance/` — LanceDB vector index
  - `vectors/config.json` — vector store configuration (embedding model, dimensions)
  - `examples/good.jsonl` — example good responses for calibration
  - `examples/bad.jsonl` — example bad responses for calibration
  - `SOUL.md` — human-readable description of the soul

### Requirement: Manifest Schema

The `manifest.json` file MUST contain the following fields: `name` (package identifier), `display_name` (human-readable name), `version` (semver string), `created_at` (ISO 8601 timestamp), `languages` (array of language codes), `description` (brief description), `chunk_count` (number of chunks in vector store), `embedding_model` (model used for embeddings), `engine_version` (soulkiller engine version), `soulType` (soul type: `personal` or `public`), and `tags` (TagSet object with category-to-string-array mapping).

#### Scenario: Manifest validation on package creation

- **WHEN** a soul package is created via `/publish`
- **THEN** the system SHALL generate a `manifest.json` with all required fields populated
- **THEN** `version` SHALL default to `1.0.0` for new packages
- **THEN** `created_at` SHALL be set to the current UTC timestamp
- **THEN** `chunk_count` SHALL reflect the actual number of chunks in the vector store
- **THEN** `soulType` SHALL be set to `personal` or `public`
- **THEN** `tags` SHALL contain the parsed TagSet (may be empty)

#### Scenario: Loading a package with missing manifest fields

- **WHEN** a soul package is loaded
- **AND** `manifest.json` is missing required fields
- **THEN** the system SHALL display a warning listing the missing fields
- **AND** attempt to load with available data
- **AND** `soulType` SHALL default to `public` if missing (backward compatibility)
- **AND** `tags` SHALL default to an empty TagSet if missing

### Requirement: /publish Command

The system SHALL provide a `/publish` command that packages the current soul into a `.soul` directory, pushes it to a GitHub repository specified by the user, and generates usage instructions.

#### Scenario: Publishing a soul to GitHub

- WHEN the user enters `/publish`
- THEN the system SHALL prompt for a GitHub repository name (format: `user/repo`)
- AND package all soul files, vector index, examples, and manifest into the `.soul` directory
- AND push the `.soul` directory contents to the specified GitHub repository
- AND display usage instructions for others to download and use the soul

#### Scenario: Publishing with no soul files

- WHEN the user enters `/publish`
- AND no soul files exist (distillation has not been run)
- THEN the system SHALL display an error indicating distillation must be completed before publishing

### Requirement: /use Command

The system SHALL provide a `/use <name>` command that downloads a soul package from GitHub (in `user/repo` format), extracts it to `~/.soulkiller/souls/<name>/`, loads it into the current REPL session, and switches the prompt to RELIC mode.

#### Scenario: Downloading and loading a soul

- WHEN the user enters `/use johndoe/my-soul`
- THEN the system SHALL download the soul package from GitHub repository `johndoe/my-soul`
- AND extract it to `~/.soulkiller/souls/my-soul/`
- AND load the soul files and vector index into the current session
- AND switch the REPL prompt to RELIC mode

#### Scenario: Soul already downloaded locally

- WHEN the user enters `/use johndoe/my-soul`
- AND `~/.soulkiller/souls/my-soul/` already exists
- THEN the system SHALL prompt the user to confirm overwrite or use existing
- AND proceed according to the user's choice

#### Scenario: Invalid repository or network failure

- WHEN the user enters `/use <name>`
- AND the GitHub repository does not exist or is inaccessible
- THEN the system SHALL display an error with the specific failure reason (404, network error, etc.)

### Requirement: /link Command

The system SHALL provide a `/link` command that detects installed Claude Desktop or Claude Code, auto-writes the MCP server configuration (`npx soulkiller-mcp <name>`), and prompts the user to restart the target application.

#### Scenario: Linking to Claude Desktop

- WHEN the user enters `/link`
- AND Claude Desktop is detected on the system
- THEN the system SHALL write the MCP server configuration for the current soul to Claude Desktop's config
- AND display a message prompting the user to restart Claude Desktop

#### Scenario: Linking with no soul loaded

- WHEN the user enters `/link`
- AND no soul is currently loaded in the session
- THEN the system SHALL display an error indicating a soul must be loaded first

#### Scenario: Neither Claude Desktop nor Claude Code detected

- WHEN the user enters `/link`
- AND neither Claude Desktop nor Claude Code is detected
- THEN the system SHALL display the manual MCP configuration instructions for the user to apply

### Requirement: /status Command

The system SHALL provide a `/status` command that displays the current soul name, chunk count, languages, engine mode (Docker/Local), and list of loaded soul files.

#### Scenario: Viewing status with a loaded soul

- WHEN the user enters `/status`
- AND a soul is loaded
- THEN the system SHALL display: soul name, chunk count, languages, engine mode, and loaded soul files (identity.md, style.md, behavior files)

#### Scenario: Viewing status with no soul loaded

- WHEN the user enters `/status`
- AND no soul is loaded
- THEN the system SHALL display the engine mode and indicate that no soul is currently loaded

### Requirement: /list Command

The system SHALL provide a `/list` command that lists all locally available souls, including both user-created souls and downloaded souls.

#### Scenario: Listing available souls

- WHEN the user enters `/list`
- THEN the system SHALL scan `~/.soulkiller/souls/` and the current project's soul directory
- AND display each soul's name, version, chunk count, and source (created/downloaded)

#### Scenario: No souls available

- WHEN the user enters `/list`
- AND no souls exist locally
- THEN the system SHALL display a message indicating no souls are available
- AND suggest using `/distill` to create one or `/use` to download one

### Requirement: /use command plays Relic animation
The /use command SHALL play the RelicLoadAnimation after loading a soul, before transitioning to the RELIC prompt.

#### Scenario: /use with animation
- **WHEN** user executes `/use douglastang` and the soul exists
- **THEN** the RelicLoadAnimation plays showing soul info
- **AND** after animation completes, the prompt changes to RELIC mode

### Requirement: Soul 打包包含 World 快照
系统在打包 soul 时 SHALL 检测绑定的世界，交互式让用户选择包含哪些世界，将选中世界的完整目录内联到包的 `worlds/` 下。Binding 配置保留在包的 `bindings/` 目录中。

#### Scenario: 打包时选择世界
- **WHEN** soul "johnny" 绑定了 "night-city" 和 "corpo-life"，用户执行 publish
- **THEN** 交互式列出两个世界供用户勾选，选中的世界内联到包中

#### Scenario: 无世界绑定时打包
- **WHEN** soul 没有绑定任何世界
- **THEN** 打包流程与现有行为一致，包中不含 worlds 目录

### Requirement: Soul 安装处理 World 冲突
安装 soul 包时，对于包中的每个世界：若本地不存在则直接安装到 `~/.soulkiller/worlds/`；若本地已存在则 SHALL 提示用户选择——保留本地版本（k）、替换为包内版本（r）、或安装为命名副本（n，格式 `<world>-<soul>`）。

#### Scenario: 安装新世界
- **WHEN** 包中含世界 "night-city"，本地不存在该世界
- **THEN** 安装到 `~/.soulkiller/worlds/night-city/`

#### Scenario: 世界已存在冲突
- **WHEN** 包中含世界 "night-city" v0.1.0，本地已有 "night-city" v0.2.0
- **THEN** 提示用户选择保留/替换/副本，显示两个版本号

### Requirement: readSoulFiles 函数导出

soul/package.ts SHALL 导出 `readSoulFiles(soulDir)` 函数，返回 `{ identity: string, style: string, behaviors: string[], capabilities: string, milestones: string }`。capabilities 和 milestones 在文件不存在时返回空字符串（向后兼容）。

#### Scenario: 读取包含新文件的 Soul

- **WHEN** 调用 `readSoulFiles` 且 soul 目录包含 capabilities.md 和 milestones.md
- **THEN** 返回结果 SHALL 包含这两个文件的完整内容

#### Scenario: 读取旧 Soul（无新文件）

- **WHEN** 调用 `readSoulFiles` 且 soul 目录不包含 capabilities.md 或 milestones.md
- **THEN** capabilities 和 milestones 字段 SHALL 返回空字符串
- **AND** 不抛出错误
