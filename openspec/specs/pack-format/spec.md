## ADDED Requirements

### Requirement: Pack meta schema
Every pack file SHALL contain a `pack-meta.json` at the archive root with the following fields: `format_version` (string), `type` ("soul" | "world"), `name` (string), `display_name` (string), `packed_at` (ISO 8601 string), `soulkiller_version` (string), `includes_worlds` (string array, soul packs only), `checksum` (string, "sha256:<hex>").

#### Scenario: Soul pack meta
- **WHEN** a soul pack is created for soul "alice" with bound worlds "night-city" and "arasaka-tower"
- **THEN** pack-meta.json contains `type: "soul"`, `includes_worlds: ["night-city", "arasaka-tower"]`, and a valid sha256 checksum

#### Scenario: World pack meta
- **WHEN** a world pack is created for world "night-city"
- **THEN** pack-meta.json contains `type: "world"`, and `includes_worlds` is absent or empty

### Requirement: Soul pack archive structure
A `.soul.pack` file SHALL be a tar.gz archive with the following structure: `pack-meta.json` at root, `soul/` containing the full soul directory (manifest.json, soul/, bindings/), and `worlds/` containing each bound world's directory.

#### Scenario: Soul pack contents
- **WHEN** soul "alice" is packed with bound world "night-city"
- **THEN** the archive contains `pack-meta.json`, `soul/manifest.json`, `soul/soul/identity.md`, `soul/soul/style.md`, `soul/bindings/night-city.json`, and `worlds/night-city/world.json`, `worlds/night-city/entries/*.md`

#### Scenario: Soul pack excludes runtime artifacts
- **WHEN** a soul is packed
- **THEN** the archive does NOT contain `soul/vectors/` or `soul/examples/` directories

### Requirement: World pack archive structure
A `.world.pack` file SHALL be a tar.gz archive with `pack-meta.json` at root and `world/` containing the world directory (world.json, entries/).

#### Scenario: World pack contents
- **WHEN** world "night-city" is packed
- **THEN** the archive contains `pack-meta.json` and `world/world.json` and `world/entries/*.md`

### Requirement: Checksum covers all data files
The checksum in pack-meta.json SHALL be computed as a SHA-256 hash over all files in the archive except pack-meta.json itself, in sorted path order.

#### Scenario: Checksum computation
- **WHEN** a pack is created with files A.json and B.md
- **THEN** the checksum is SHA-256 of concatenated contents of A.json and B.md (sorted by path)

### Requirement: Format version compatibility
The system SHALL reject packs with a `format_version` major version higher than the supported version.

#### Scenario: Compatible version
- **WHEN** unpacking a pack with `format_version: "1.0"` and the system supports "1.x"
- **THEN** unpacking proceeds

#### Scenario: Incompatible version
- **WHEN** unpacking a pack with `format_version: "2.0"` and the system only supports "1.x"
- **THEN** the system displays an error and aborts

### Requirement: pack 解压实现
`.soul.pack` / `.world.pack` 解包 SHALL 使用纯 TypeScript 实现（`fflate.gunzipSync` + `nanotar.parseTar`），不得通过 `child_process.exec`/`execSync`/`execFile` 调用系统 `tar` 可执行文件。该要求在 Windows / Linux / macOS 三端必须行为一致。

#### Scenario: Unix 解包
- **WHEN** 用户在 Linux 或 macOS 上执行 `/unpack foo.soul.pack`
- **THEN** 解包过程不 spawn 任何子进程，纯 JS 完成 gunzip + tar parse

#### Scenario: Windows 解包
- **WHEN** 用户在 Windows 上执行 `/unpack foo.soul.pack`
- **THEN** 解包过程不调用 `tar.exe` / PowerShell，纯 JS 完成；与 Unix 行为一致

#### Scenario: 格式兼容性
- **WHEN** 用新版 CLI 解包旧版生成的 `.soul.pack` / `.world.pack`
- **THEN** 所有既有文件条目正确还原，含文件内容与相对路径；老版 pack 格式未变更
