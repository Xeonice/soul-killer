### Requirement: soulkiller.json 作者版本字段

导出流水线 SHALL 在 `soulkiller.json` 写入 `version: string` 字段，代表 skill 作者声明的版本号。该字段与 `engine_version` / `soulkiller_version` / `exported_at` 并列，语义独立。

#### Scenario: 作者填了版本号

- **WHEN** 导出向导中作者输入 `"1.2.0"`，并完成导出
- **THEN** 归档根目录 `soulkiller.json` SHALL 包含 `"version": "1.2.0"`；其他三个版本相关字段保持不变

#### Scenario: 单测直接驱动 builder 未填版本号

- **WHEN** 单元测试直接调用 `ExportBuilder` 的 `build()` 而未调用 `setAuthorVersion`
- **THEN** packager 写出的 `soulkiller.json` SHALL 使用 `"0.0.0"` 作为 fallback；`build()` 不因缺 version 而抛错

### Requirement: 导出向导的 "skill version" 步骤

REPL `/export` 命令的向导 SHALL 在 prose style 步骤完成之后、agent 启动之前，新增一个 "skill version" 步骤：向作者展示必填输入框 + 预填的默认值；Enter 接受默认，任意字符串可手填；空值不允许提交。

#### Scenario: 首次导出某 skill

- **WHEN** 目标路径下不存在旧的 `soulkiller.json`（或解析失败）
- **THEN** 步骤预填默认值 SHALL 为 `"0.1.0"`；hint 文案说明 "推荐 semver，也接受日期 / 自定义字符串"

#### Scenario: 再次导出同 skill，版本号符合 semver patch

- **WHEN** 目标路径下存在 `soulkiller.json`，其 `version` 为 `"1.0.3"`
- **THEN** 步骤预填默认值 SHALL 为 `"1.0.4"`（bump patch）

#### Scenario: 再次导出，旧版本号不符合 semver

- **WHEN** 旧 `version` 为 `"2026.04.15"`（无法正则匹配 semver patch）
- **THEN** 步骤预填默认值 SHALL 为 `"2026.04.15-1"`（保留原格式 + 追加 `-1` 后缀）

#### Scenario: 空值禁止提交

- **WHEN** 作者清空输入框并按 Enter
- **THEN** 步骤 SHALL 不前进；以徽章或底部文案提示 "版本号不能为空"

#### Scenario: 作者接受默认值

- **WHEN** 步骤载入完成后作者直接按 Enter，未修改默认值
- **THEN** 向导 SHALL 以默认值作为 author_version 继续；不再二次确认

### Requirement: bumpPatch 推导工具

推导默认值的 `bumpPatch(existing: string)` 工具 SHALL 按以下规则返回新版本号：

- 匹配 `/^(\d+\.\d+\.)(\d+)$/` → 最后段 +1（如 `1.0.3` → `1.0.4`）
- 匹配 `/^(\d+\.\d+)$/` → 追加 `.1`（如 `1.2` → `1.2.1`）
- 其他任意字符串 → 追加 `-1`（如 `beta` → `beta-1`，`2026.04.15` → `2026.04.15-1`）

#### Scenario: 标准 semver patch 升位

- **WHEN** 输入 `"1.0.3"`
- **THEN** 输出 `"1.0.4"`

#### Scenario: 两段式版本补全为三段

- **WHEN** 输入 `"1.2"`
- **THEN** 输出 `"1.2.1"`

#### Scenario: 非标准格式回退到尾缀

- **WHEN** 输入 `"beta"`
- **THEN** 输出 `"beta-1"`

#### Scenario: 日期格式回退到尾缀

- **WHEN** 输入 `"2026.04.15"`
- **THEN** 输出 `"2026.04.15-1"`

### Requirement: ExportBuilder 版本号接入

`ExportBuilder` SHALL 暴露 `setAuthorVersion(v: string): void`；`build()` 的返回值中 `story_spec` SHALL 含 `author_version: string` 字段，缺省为 `"0.0.0"`。

#### Scenario: 通过 setter 设置版本号

- **WHEN** 在 `finalize_export` 之前调用 `builder.setAuthorVersion("1.2.0")`
- **THEN** `builder.build().story_spec.author_version` SHALL 为 `"1.2.0"`

#### Scenario: 未调用 setter

- **WHEN** 直接调用 `builder.build()` 而没有设置 version
- **THEN** `story_spec.author_version` SHALL 为 `"0.0.0"`；`build()` 不抛错

### Requirement: build-catalog 读取作者版本

`scripts/build-catalog.ts` SHALL 将 catalog 条目的 `version` 字段取自归档内 `soulkiller.json.version`；缺失时 fallback 为 `"0.0.0"` 并在 stderr 输出警告 `⚠ <slug>: soulkiller.json lacks 'version' field; defaulting to 0.0.0`。

#### Scenario: 归档含 version 字段

- **WHEN** `examples/skills/alpha.skill` 内 `soulkiller.json.version` 为 `"1.2.0"`
- **THEN** catalog 条目 `version` SHALL 为 `"1.2.0"`

#### Scenario: 归档缺 version 字段

- **WHEN** 归档内 `soulkiller.json` 不含 `version` 键
- **THEN** catalog 条目 `version` SHALL 为 `"0.0.0"`；stderr 输出对应警告

### Requirement: 老归档回填 version 字段

`scripts/upgrade-example-skills.ts` 在升级归档时 SHALL 检查 `soulkiller.json`：若缺 `version` 字段，写入 `"0.0.0"`，并在 stdout 以 `filled missing version: 0.0.0` 一行呈现（紧跟现有 `stripped: …` / `engine_version: …` 风格）。

#### Scenario: 升级一个缺 version 字段的老归档

- **WHEN** 升级一个 `soulkiller.json` 不含 `version` 的归档
- **THEN** 重打包后 `soulkiller.json` SHALL 含 `"version": "0.0.0"`；stdout 有对应提示

#### Scenario: 升级一个已带 version 的归档

- **WHEN** 升级一个 `version: "1.0.0"` 的归档
- **THEN** 重打包后 `version` 字段 SHALL 保持 `"1.0.0"`；stdout 不打印回填提示

#### Scenario: --check 模式识别缺字段为过期原因

- **WHEN** `scripts/upgrade-example-skills.ts --check` 扫到缺 `version` 字段的归档
- **THEN** 报告 SHALL 列出该归档过期；退出码 `1`；提示运行升级

### Requirement: 作者版本 lint

`src/export/support/lint-skill-template.ts` SHALL 新增规则 `AUTHOR_VERSION_PRESENT`：若导出产物的 `soulkiller.json` 缺 `version` 或值为 `"0.0.0"`，输出 warning（不阻断）。

#### Scenario: 导出产物缺 version

- **WHEN** lint 运行在缺 `version` 字段的产物
- **THEN** 输出 `AUTHOR_VERSION_PRESENT` warning 到 stderr；export 正常完成

#### Scenario: 导出产物 version 为 0.0.0

- **WHEN** lint 运行在 `version: "0.0.0"` 的产物
- **THEN** 输出相同 warning，提示 "0.0.0 保留给未知来源的老归档；新导出请填 >= 0.1.0"

#### Scenario: 导出产物 version >= 0.1.0

- **WHEN** lint 运行在 `version: "0.1.0"` 的产物
- **THEN** `AUTHOR_VERSION_PRESENT` 规则 SHALL 通过，无 warning
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
