## ADDED Requirements

### Requirement: catalog.json 端点
Worker SHALL 在 `/examples/catalog.json` 提供可公开访问的 JSON 端点，内容为 CI 自动生成的 skill 清单；响应 `Content-Type: application/json`，且允许跨源（CORS）。

#### Scenario: 正常返回
- **WHEN** 客户端 GET `/examples/catalog.json`
- **THEN** 返回 HTTP 200 + JSON 响应，顶层字段 `version` / `updated_at` / `soulkiller_version_min` / `skills[]` 齐备

### Requirement: catalog.json schema
catalog JSON SHALL 遵循以下结构：顶层 `version: 1`、`updated_at: ISO8601 string`、`soulkiller_version_min: semver string`、`skills: array`。每个 skills 元素 SHALL 包含 `slug`（kebab-case）、`display_name`、`description`、`version`（semver）、`engine_version`（int）、`size_bytes`（int）、`sha256`（hex string）、`url`（相对或绝对）、`soulkiller_version_min`（semver）。可选字段：`characters: string[]`、`tags: string[]`。

#### Scenario: 完整条目
- **WHEN** CI 为 `fate-zero.skill` 生成条目
- **THEN** 输出如 `{ "slug": "fate-zero", "display_name": "Fate/Zero", "description": "…", "version": "1.0.0", "engine_version": 3, "size_bytes": 2411724, "sha256": "abc…", "url": "/examples/skills/fate-zero.skill", "soulkiller_version_min": "0.4.0", "characters": ["saber"], "tags": ["visual-novel"] }`

#### Scenario: 客户端向前兼容
- **WHEN** Worker 升级到未来 `version: 2` 格式但客户端仍是 v1
- **THEN** 客户端识别 `version !== 1` 时打印警告 "catalog version unsupported; please update soulkiller" 并 fall back 到缓存

### Requirement: CI 生成流水线
构建流水线 SHALL 在每次 `.skill` 发布前扫描 `examples/skills/*.skill`，对每个档案解包读取 `soulkiller.json` 与 `SKILL.md` frontmatter，计算 sha256，合成 `catalog.json`，随 `.skill` 一并上传到 Worker。

#### Scenario: 新增 skill
- **WHEN** 开发者把新的 `examples/skills/new-game.skill` 提交到仓库并推送
- **THEN** CI 自动重新生成 `catalog.json` 包含新条目；下一次 `soulkiller skill catalog` 即可看到

#### Scenario: 删除 skill
- **WHEN** 开发者从 `examples/skills/` 删除某个 `.skill`
- **THEN** CI 生成的新 `catalog.json` 不再包含该条目；已装在本地的 skill 不受影响

#### Scenario: sha256 计算
- **WHEN** CI 为 `.skill` 计算 sha256
- **THEN** 使用 SHA-256 over 整个档案字节流，输出 64 字符 hex 字符串

### Requirement: CLI catalog URL 解析
CLI SHALL 按下列优先级解析 catalog URL：命令行 `--catalog <url>` > 环境变量 `SOULKILLER_CATALOG_URL` > 硬编码默认值 `https://soulkiller-download.ad546971975.workers.dev/examples/catalog.json`。

#### Scenario: 显式 flag 覆盖 env
- **WHEN** 用户设 `SOULKILLER_CATALOG_URL=a` 且执行 `soulkiller skill install foo --catalog b`
- **THEN** CLI 使用 `b` 作为 catalog 源

#### Scenario: env 覆盖默认
- **WHEN** 用户仅设 `SOULKILLER_CATALOG_URL=custom-url` 未传 `--catalog`
- **THEN** CLI 使用 `custom-url`

#### Scenario: 都未设用默认
- **WHEN** 用户既未设 env 也未传 flag
- **THEN** CLI 使用硬编码默认 URL

### Requirement: 本地缓存与降级
CLI SHALL 将成功拉取的 catalog.json 缓存到 `~/.soulkiller/cache/catalog.json`；网络失败时优先读缓存并提示缓存时间；缓存超过 7 天时打印警告但仍使用。

#### Scenario: 网络失败用缓存
- **WHEN** `skill install` 执行时 Worker 不可达，但本地缓存存在
- **THEN** CLI 使用缓存并打印 "using cached catalog from <ISO time>"，继续安装

#### Scenario: 无缓存且网络失败
- **WHEN** Worker 不可达，本地无缓存
- **THEN** CLI abort，提示 "catalog unavailable; check network or pass --catalog <url>"

#### Scenario: 缓存过期警告
- **WHEN** 缓存已存在 8 天
- **THEN** CLI 仍使用缓存但打印 "cached catalog is 8 days old; consider running `skill catalog --refresh`"

### Requirement: `skill catalog` 子命令
CLI SHALL 提供 `soulkiller skill catalog` 子命令列出 catalog 中所有可装 skill；`--json` 标志下输出原始 JSON，否则输出人类可读表格（slug / display_name / version / size）。

#### Scenario: 人类可读表格
- **WHEN** 用户执行 `soulkiller skill catalog`
- **THEN** stdout 输出多行对齐表格，每行为一条 skill，包含 slug、display_name、version、size

#### Scenario: JSON 输出
- **WHEN** 用户执行 `soulkiller skill catalog --json`
- **THEN** stdout 输出 catalog.json 原始内容（保留字段序、格式化为 2 空格缩进）
