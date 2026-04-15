## ADDED Requirements

### Requirement: README 占位符段

仓库根 `README.md` SHALL 包含成对的占位符标记 `<!-- SKILLS:START -->` 和 `<!-- SKILLS:END -->`，两者之间的内容 SHALL 由 `scripts/build-skill-catalog.ts` 自动写入、禁止手改。脚本 SHALL 保留两个占位符本身不变；仅替换之间的内容。

#### Scenario: 占位符存在且格式正确

- **WHEN** 仓库包含 README.md 且两个占位符成对存在
- **THEN** 脚本 SHALL 仅替换占位符之间的内容，不影响文件其他部分

#### Scenario: 占位符缺失

- **WHEN** 脚本找不到任一占位符
- **THEN** 脚本 SHALL 以非 0 退出码失败，并在 stderr 提示需要手动插入占位符段

### Requirement: build-skill-catalog.ts 脚本

仓库 SHALL 提供 `scripts/build-skill-catalog.ts`，负责扫描 `examples/skills/*.skill` 并生成 README 可装列表。脚本 SHALL 支持两种模式：默认写入 README；`--check` 干跑对比当前 README 内容，不一致时以非 0 退出码失败。

#### Scenario: 默认模式写入

- **WHEN** 执行 `bun scripts/build-skill-catalog.ts`
- **THEN** 脚本 SHALL 解包每个 `.skill`，读取根目录 `soulkiller.json` 与 `SKILL.md` frontmatter，生成 markdown 表（三列：slug / 世界 / 说明），并替换 README 占位符之间的内容
- **AND** 若 README 已是目标内容，进程 SHALL 以 0 退出且无副作用

#### Scenario: --check 模式发现不一致

- **WHEN** 执行 `bun scripts/build-skill-catalog.ts --check`，且 README 当前内容与即将生成的目标内容不一致
- **THEN** 脚本 SHALL 不修改任何文件，打印 unified diff 到 stdout，以非 0 退出码失败

#### Scenario: --check 模式一致

- **WHEN** 执行 `bun scripts/build-skill-catalog.ts --check`，且 README 已是最新
- **THEN** 脚本 SHALL 以 0 退出

### Requirement: 元数据读取顺序与字段映射

脚本 SHALL 按下列优先级为每个 skill 归档解析 slug / 世界 / 说明三列，并允许老归档降级：

1. `soulkiller.json` 的 `world_slug` / `world_name` / `summary` — 首选
2. 若任一字段缺失：slug 回退为 `soulkiller.json.skill_id`；世界列回退为 `—`；说明列回退为 `SKILL.md` frontmatter 的 `description`

#### Scenario: 新归档三字段齐全

- **WHEN** `.skill` 的 `soulkiller.json` 含 `world_slug: "fate-zero"`、`world_name: "Fate/Zero"`、`summary: "第四次圣杯战争，含…完整卡司"`
- **THEN** 表格相应行 SHALL 直接使用这三个值

#### Scenario: 老归档三字段缺失

- **WHEN** `.skill` 的 `soulkiller.json` 不含三字段，`skill_id` 为 `"fz-in-fate-zero"`，`SKILL.md` frontmatter `description` 为 `"fz — 在Fate Zero中的多角色视觉小说…"`
- **THEN** 表格行 SHALL 为 `fz-in-fate-zero | — | fz — 在Fate Zero中的多角色视觉小说…`
- **AND** 脚本 SHALL 在 stderr 打印 warning 指出归档缺字段

### Requirement: 行排序

生成的表格 SHALL 按 slug 升序排列，保证稳定输出。

#### Scenario: 多归档排序

- **WHEN** `examples/skills/` 下含 3 个 skill，对应 slug 为 `white-album-2`、`fate-zero`、`three-kingdoms`
- **THEN** 表格顺序 SHALL 为 `fate-zero`、`three-kingdoms`、`white-album-2`

### Requirement: CI 注入流水线

`.github/workflows/release.yml` SHALL 在 tag 触发的 workflow 中、构建二进制之前运行 `bun scripts/build-skill-catalog.ts`。若脚本修改了 README，workflow SHALL 使用 `github-actions[bot]` 身份 commit 修改并 push 回 `main` 分支；然后继续执行后续构建步骤。

#### Scenario: Tag 触发且 README 有 diff

- **WHEN** 推送 tag `v0.7.0`，且执行脚本后 README 发生变化
- **THEN** release workflow SHALL commit 修改（commit message 含 tag 版本号），push 回 main，然后继续二进制构建；Release 产物不受影响

#### Scenario: Tag 触发且 README 已最新

- **WHEN** 推送 tag `v0.7.0`，脚本执行后 README 无变化
- **THEN** workflow SHALL 跳过 commit 步骤，直接进入下一阶段

### Requirement: CI 干跑校验

`.github/workflows/ci.yml` SHALL 新增 `verify-skill-catalog` job，对每个 PR 运行 `bun scripts/build-skill-catalog.ts --check`。不一致时 job 失败，阻断合入。

#### Scenario: PR 修改了 .skill 但忘了更新 README

- **WHEN** PR 替换了 `examples/skills/fate-zero.skill`，但 README 未同步
- **THEN** `verify-skill-catalog` job SHALL 失败，job log 打印 diff 并提示作者本地跑脚本后 commit
