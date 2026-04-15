## ADDED Requirements

### Requirement: soulkiller.json 目录展示字段

导出流水线 SHALL 在 `soulkiller.json` 额外写入三个目录展示字段：`world_slug: string`（kebab-case 短 slug）、`world_name: string`（规范化世界名）、`summary: string`（单行说明）。三字段与 `engine_version` / `soulkiller_version` / `exported_at` / `skill_id` / `version` 并列，语义纯展示，不参与运行时契约。

#### Scenario: 作者完成 catalog-info 步骤

- **WHEN** 导出向导中作者为某 skill 输入 slug=`"fate-zero"`、世界=`"Fate/Zero"`、说明=`"第四次圣杯战争，含…完整卡司"`
- **THEN** 归档根目录 `soulkiller.json` SHALL 包含：
  - `"world_slug": "fate-zero"`
  - `"world_name": "Fate/Zero"`
  - `"summary": "第四次圣杯战争，含…完整卡司"`
- **AND** 其他技术字段保持不变

#### Scenario: 单测直接驱动 builder 未填三字段

- **WHEN** 单元测试直接调用 `ExportBuilder` 的 `build()` 而未设置 catalog-info
- **THEN** packager 写出的 `soulkiller.json` SHALL 对缺失字段使用空字符串 `""` 作为 fallback；`build()` 不因缺字段而抛错

#### Scenario: 字段类型校验

- **WHEN** buildSoulkillerManifest 被调用
- **THEN** 输出 JSON 中三字段 SHALL 均为 string 类型（即便为空也是 `""` 而非 `null` / 省略）
