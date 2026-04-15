## Why

仓库 README 里的"可装 skill 列表"目前只能硬编码维护——每发版手动改表格，极易漏同步。现有 `soulkiller.json` 只有技术字段（`engine_version`、`skill_id`、`version`…），缺少人类可读的短 slug、世界名、简介三列，无法支撑自动生成。三个示例 skill 已经稳定交付，值得一次性打通"导出填元数据 → 发版扫归档 → 注入 README"的闭环，避免长期维护成本。

## What Changes

- **soulkiller.json 新增 3 个展示字段**：`world_slug`（kebab-case 短名，如 `fate-zero`）、`world_name`（规范化世界名，如 `Fate/Zero`）、`summary`（单行说明）。与 `engine_version` 等并列，语义纯展示。
- **导出流水线 3 层协作**：
  - LLM 在 `set_story_metadata` 工具里新增三字段作为候选（从 user_direction / 角色卡推断）
  - Wizard 在 author-version 步骤之后新增一步 "catalog info"，预填 LLM 候选，允许用户编辑确认
  - ExportBuilder / packager 将最终值写入 soulkiller.json
- **新增 `scripts/build-skill-catalog.ts`**：扫描 `examples/skills/*.skill`，解包读 `soulkiller.json` + `SKILL.md` frontmatter，生成 markdown 表，替换 README 占位符块 `<!-- SKILLS:START -->...<!-- SKILLS:END -->`。支持 `--check` 干跑模式供 CI 校验。
- **README 引入占位符段**：新增 `<!-- SKILLS:START -->` / `<!-- SKILLS:END -->` 标记段，段内内容完全由脚本写入。
- **release.yml tag 触发后注入**：打 `v*` tag 的 release workflow 在构建前运行 `build-skill-catalog.ts`，若 README diff 非空则 commit 回 main（与 tag 同个 workflow，不单独 PR）。
- **ci.yml PR 干跑校验**：新增 `verify-skill-catalog` job，跑 `--check` 模式；README 与归档数据不一致则阻断 PR（对标 `verify-examples`）。
- **老归档降级**：缺三字段的归档，脚本回退——slug 用 `skill_id`、world_name 用 `—`、summary 用 SKILL.md 的 `description`，同时 stderr 打 warning。不阻塞脚本。

## Capabilities

### New Capabilities

- `readme-skill-catalog`: 从 `examples/skills/*.skill` 扫描元数据，自动生成 README 中的"可装 skill 列表"markdown 表；CI 触发注入与校验流程。

### Modified Capabilities

- `skill-author-version`: soulkiller.json 的字段清单新增 `world_slug` / `world_name` / `summary` 三个展示字段，与已有的 `version` 并列。
- `export-agent`: `set_story_metadata` 工具 schema 新增三个字段参数，LLM 产出候选值写入 ExportBuilder。
- `export-command`: 导出向导在 author-version 步骤之后新增一步 "catalog info"，展示 LLM 预填值并允许编辑确认。
- `release-ci`: release workflow tag 触发后、构建前新增 build-skill-catalog 注入步骤，diff 非空则 commit 回 main。

## Impact

- 代码：
  - `src/export/packager.ts` — `buildSoulkillerManifest` 扩参
  - `src/export/agent/types.ts` — `StoryMetadata` 扩 3 字段，ExportBuilder 同步
  - `src/export/agent/story-setup.ts` — `set_story_metadata` tool schema + inputExamples
  - `src/export/agent/prompts.ts` — 指引 LLM 产出三字段候选
  - `src/cli/commands/export/*` — 新增 catalog-info 向导步骤（对标 entering-version 的结构）
  - `scripts/build-skill-catalog.ts` — 新文件
  - `README.md` — 加占位符段
  - `.github/workflows/release.yml` — 新增注入步 + 回推 commit
  - `.github/workflows/ci.yml` — 新增 verify-skill-catalog job
- 测试：
  - `tests/unit/export/packager-contract.test.ts` — 断言新字段 shape
  - `tests/unit/export/packager-manifest.test.ts`（若有）或新建 — buildSoulkillerManifest 三字段单测
  - `scripts/build-skill-catalog.test.ts`（或纳入现有位置）— check 模式、降级路径、占位符替换
- 依赖：无新增 npm 依赖。脚本只用 bun stdlib（`Bun.file`、`fflate` 或 `unzip` 子进程解压）。
- 兼容性：现存归档无新字段也能跑（走降级路径 + warning）。下游 `soulkiller skill catalog` 的云端 catalog.json（`skill-catalog` 能力）不受影响，两者数据源独立。
