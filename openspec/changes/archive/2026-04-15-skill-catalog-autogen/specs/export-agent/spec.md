## ADDED Requirements

### Requirement: set_story_metadata 产出目录展示候选

`set_story_metadata` 工具 schema SHALL 新增三个必填字段：`world_slug: string`、`world_name: string`、`summary: string`。LLM SHALL 在调用该工具时从 `user_direction` / 角色卡 / 世界文件内容推断候选值并一并传入；ExportBuilder SHALL 连同原有 metadata 一同存储。

#### Scenario: LLM 传入三字段

- **WHEN** LLM 调用 `set_story_metadata` 传入 `world_slug: "fate-zero"`、`world_name: "Fate/Zero"`、`summary: "第四次圣杯战争，六位御主与九位英灵的死斗"` 以及原有的 genre / tone / constraints / acts_options / default_acts
- **THEN** ExportBuilder SHALL 将三字段保存为 metadata 的一部分，供 wizard 预填与 packager 写入 soulkiller.json

#### Scenario: LLM 遗漏三字段

- **WHEN** LLM 调用 `set_story_metadata` 时未提供三字段中的任何一个
- **THEN** 工具 SHALL 返回 error，要求 LLM 重新调用并补全；不应默默接受空值

### Requirement: 目录展示字段的内容约束

LLM 产出的候选值 SHALL 遵循以下格式：

- `world_slug`：kebab-case ASCII，仅 `[a-z0-9-]+`，长度 2–32
- `world_name`：自然语言世界名，长度 ≤ 40，不强制语言
- `summary`：单行（不含换行），长度 ≤ 80，概括世界+主要冲突或主要角色

工具 SHALL 对不符合规则的输入返回 error，LLM 须修正后重试。

#### Scenario: world_slug 含大写或下划线

- **WHEN** LLM 传入 `world_slug: "Fate_Zero"`
- **THEN** 工具 SHALL 返回 error 指出需要 kebab-case ASCII

#### Scenario: summary 含换行

- **WHEN** LLM 传入 `summary: "第四次圣杯战争\n六位御主的死斗"`
- **THEN** 工具 SHALL 返回 error 指出 summary 必须单行
