## Context

本 change 紧接 `skill-manage-installed`，补其遗留的一个设计缺口：作者版本号。

**现状**（2026-04-15）：

- `src/export/packager.ts:282-287` 生成 `soulkiller.json`，只写 `engine_version` / `soulkiller_version` / `exported_at` / `skill_id`；没有作者可控的 `version`。
- `scripts/build-catalog.ts:114` 写 catalog 条目的 `version` 字段时取的是 `soulkillerVersion`——跟 `soulkiller_version` 同源，这在 dev 模式都是 `"dev"`，在 release 是二进制版本。作者对此完全无感知。
- `src/cli/skill-install/scanner.ts:readInstallRecord` 已在读 `raw.version` 字段，但 `raw` 里永远没这个键，永远返回 `null` → `diff.ts` 报 `unknown-version`。
- REPL Installed Tab 的兜底："版本未知 + catalog 有条目"→ 给"强制重装"按钮（`install.action.reinstall`）。本 change 落地后，多数情况会走正常 "Update to vX"，reinstall 只剩老归档兼容路径。

**利益相关者**：

- **skill 作者**：想表达语义清晰的版本号；首次发布不想卡在"填什么"的决策里。
- **skill 用户**：能看到明确的版本对比；升级按钮在该出现时出现。
- **CI / catalog publisher**：catalog 的 `version` 字段与归档自声明对齐，不再是 shadow-linked 到构建版本。

**约束**：

- 不改 engine_version / soulkiller_version / exported_at 三个已有字段的语义。
- 向后兼容：老归档没有 `version` 字段时，所有工具链必须能优雅降级。
- 导出流程是 agent 驱动的；作者输入在 agent 启动**之前**发生（prompt 属于向导步骤而非 LLM 工具）。
- 不假设作者懂 semver；格式尽量宽松。

## Goals / Non-Goals

**Goals:**

- skill 每次导出都有明确的作者版本号。
- 首次导出默认 `0.1.0`；再次导出默认 bump patch，降低决策成本。
- catalog `version` 字段反映作者意图，不再混淆二进制版本。
- 老归档仍能安装 / 扫描 / 升级，不产生回归。
- `skill-manage-installed` 的 `updatable` 判定首次变得可真正触达。

**Non-Goals:**

- **不做** semver 强校验；作者用日期、beta-N、git-hash 都放行。
- **不做** 自动发版号推导（如 git tag、changelog 解析）——留给未来。
- **不做** 跨 skill 的版本一致性检查（如 "依赖 other-skill 必须 >=1.2"）。
- **不改** engine_version 语义——它跟本字段正交。
- **不做** release 流水线的版本 gate（如 CI 拒绝 `0.0.0`）——lint 层 warn 而已。
- **不处理** `soulkiller skill upgrade`（engine 修复）的语义——与 skill 版本无关。

## Decisions

### D1. 输入入口放在向导，不放在 agent 工具

**Choice:** 在 `/export` REPL 向导中新增一步 "skill version" prompt，发生在 agent 启动之前；不以 `set_story_version` agent 工具形式出现。

**Why:**
- 版本号是作者决策，不是 LLM 推导结果；让 agent "替作者选版本号"是违反意图的错位。
- 向导步骤天然支持"首次 0.1.0 / 再次 bump patch"的 default 推导，prompt 预填光标即可；agent 工具难做这种 UX。
- 若作为 agent 工具，一旦 LLM 忘了调 or 乱填，export 就失败或污染——而版本字段是纯数据，本来不需要 reasoning。

**Alternatives considered:**
- *Agent 工具 `set_story_version`*：LLM 自由度太大，容易违背作者意图；调用时机也难约束（必须在 `set_story_metadata` 之后、`finalize_export` 之前？）。
- *story-spec 前置声明*：作者要改 yaml——比 REPL 里按 Enter 接受默认值繁琐。
- *完全 inferred（导出时直接写 0.0.1 + 1）*：作者没机会指定 major/minor 语义。

### D2. 必填 + 智能默认

**Choice:** 向导步骤不允许空值提交；但总是有预填值，光标停在输入框末尾，Enter 即用默认。

**默认值推导**：
```
if (existing soulkiller.json at target path && 能解析 .version) {
  default = bumpPatch(existing.version)   // "1.0.3" → "1.0.4"
} else {
  default = "0.1.0"                        // 惯例首版
}
```

- `bumpPatch` 实现：正则 `/^(\d+\.\d+\.)(\d+)$/`，匹配则 +1；不匹配则 fallback `${existing}-1` 或直接 `0.1.0`。

**Why:**
- 必填确保每个新归档都带 version——不留 `null`，根治 `unknown-version` 的数据源。
- 有默认值降低首次用户摩擦；有 bump patch 降低迭代用户摩擦。
- 允许用户覆盖默认 → 重大发版（`major`）时作者能手填 `2.0.0`。

**Alternatives considered:**
- *可选 + 缺省 0.0.1*：会让"用户没意识到要填"变成数据污染源。
- *强制每次手填无默认*：把"我只是修了个 typo 重导"的场景拖慢。

### D3. 格式约束——推荐 semver，不强制

**Choice:** 接受任意非空字符串。在向导 prompt 的 hint 文案里写 "推荐 semver（如 1.0.0），也接受日期或自定义格式"。

**Why:**
- 作者群体异构，semver 纪律不可强加。
- diff.ts 只做字符串严格相等（`==`）判定，对格式不敏感——"1.0.1" vs "1.0.2" 不等 = updatable，这就够了。
- 未来要加 semver 比对可作为选项（"catalog 里有更高 semver"），本次不做。

**Alternatives considered:**
- *强制 `/^\d+\.\d+\.\d+$/`*：过度约束，阻碍灵活命名。
- *强制最少 `<number>.<number>`*：也拒绝 `beta-1` / `2026.04.15`；不值得。

### D4. 老归档兼容：缺字段 → 扫描时显示 `unknown`，升级时写 `0.0.0`

**Choice:**
- **scanner**：`version` 字段缺失 → `InstallRecord.version = null` → diff 报 `unknown-version`（已有行为）。
- **build-catalog**：读不到 `version` → 写入 `"0.0.0"` + stderr 警告 `⚠ <slug>: soulkiller.json lacks 'version' field; defaulting to 0.0.0`。
- **upgrade-example-skills**：升级老归档时若缺 `version` 字段，写入 `"0.0.0"`（不是 "0.1.0"——`0.0.0` 明确表示"未知来源"）。
- **REPL Installed Tab**：保留已有"强制重装"按钮作为兜底。

**Why:**
- `0.0.0` 作为"本归档没带版本元数据"的显式标记，让下游处理可以区分"作者填了 0.0.0"（罕见）和"我们回填的占位"（常见）——两者行为一致，但调试日志可区分。
- 老归档在 catalog 中以 `0.0.0` 出现后，用户刷 catalog（拿到作者新导出的 `0.1.0+`）即自然成为 `updatable`，走 Update 按钮——不需要强制重装路径。
- 不引入额外 migration 工具；`upgrade-example-skills.ts` 已是维护 examples 的入口。

**Alternatives considered:**
- *缺 `version` 直接拒装*：Breaking change，不可接受。
- *从 `soulkiller_version` 或 `exported_at` 推导*：回归到本提案要修的 shadow-linking 问题。

### D5. 改 build-catalog 的 `version` 取值源

**Choice:** `scripts/build-catalog.ts:114` 改为：
```ts
version: parsed.version ?? '0.0.0',
```

同时保留 `soulkiller_version` 变量用于其他用途（如果未来加 `soulkiller_version_min` 的校验要知道构建版本）。

**Why:**
- 这是 catalog 和 scanner 能真正对齐的关键接口——现在是错位的。
- 保持极简：不再引入 "catalog 做一层推导" 的逻辑。

### D6. ExportBuilder / packager 接线

**Choice:**
- `ExportBuilder` 新增 `private authorVersion?: string` + `setAuthorVersion(v: string)` + `build()` 返回值里带 `author_version`。
- Wizard 在 agent 启动前调用 `builder.setAuthorVersion(chosen)`。若 agent 后续流程失败，version 也被 drop（不落地）——符合原子性预期。
- `packager.ts` 写 `soulkiller.json` 时从 `story_spec.author_version` 读，缺省（单元测试场景）fallback `"0.0.0"`。

**Why:**
- 用 builder 接线而非环境变量 / 全局 state，便于单测 isolate。
- 写到 `story_spec` 而不是 packager 的参数，允许其他消费者（lint、spec 生成）访问同一来源。

**Alternatives considered:**
- *packager 直接参数*：ExportCommand 要多透传一路，污染接口；story_spec 本就是元数据总线。

## Risks / Trade-offs

- **[作者乱填格式]** → 不 enforce，容忍；但 `skill list` / `skill info` 会原样显示。如果破坏太多，下期可加 semver 推荐 lint。
- **[已装老归档永远不"更新"到 0.1.0]** → 用户刷 catalog 拿到 `0.1.0` 时 diff 给 `updatable (0.0.0 → 0.1.0)`；点 Update 即可。但若作者没重导出 skill（catalog 也还是 `0.0.0`），就保持 `up-to-date`——这是正确的（没有新版本）。
- **[ExportBuilder 单测要加 version 默认]** → 已有的 `__TEST_ONLY_ExportBuilder` 测试若不填 version 会报错；所以在 builder 内让 `author_version` **可选**，`build()` 时缺省填 `0.0.0`（等价 packager 的 fallback）。只有向导路径强制填；直调 builder 的测试自由。
- **[向导新步骤破坏 E2E]** → `tests/e2e/08-export.test.ts` 要同步更新——预期多一步 Enter。
- **[catalog `0.0.0` 污染展示]** → 在 `skill list --catalog` 里看到 `0.0.0` 会让人觉得是"第一个版本"；加一行 footer 提示 `(⚠ legacy archives — version unset)`。

## Migration Plan

**阶段 1：数据层（无用户可见变化）**

1. `ExportBuilder` 新增 author_version 字段 + setter。
2. `packager.ts` 写 `soulkiller.json` 加 `version`（缺省 `"0.0.0"`）。
3. 单元测试：packager 产出含 `version` 字段；builder 默认 `0.0.0`。

**阶段 2：Catalog / Scanner**

4. `build-catalog.ts` 改读 `parsed.version`。
5. `scripts/upgrade-example-skills.ts` 升级流程在缺 `version` 时回填 `0.0.0`。
6. 跑一次 `bun scripts/upgrade-example-skills.ts`，把 3 个 example 的缺字段回填。
7. 跑一次 `bun scripts/build-catalog.ts`，刷新 `dist/catalog.json`。

**阶段 3：向导入口**

8. 实现 version step UI（可放在 `export.tsx` 或抽 `version-step.tsx`）。
9. 引入 `bumpPatch` 工具（轻量，5 行左右）。
10. 对已有目标路径做 `readExistingVersion` probe → 推导默认值。
11. 连入 ExportCommand 状态机。

**阶段 4：Lint + 文案 + 测试**

12. Lint `AUTHOR_VERSION_PRESENT`：归档无 `version` 或值 `0.0.0` 时 warn。
13. i18n：`export.version.prompt` / `export.version.hint_semver` / `export.version.default_first` / `export.version.default_bumped`（zh / en / ja）。
14. E2E：`tests/e2e/08-export.test.ts` 加"Enter 接受 0.1.0"步骤。
15. README 段落同步。

**Rollback:** 每阶段独立可回退。阶段 1-2 完成后停也可以（数据层已完备，只是向导还没入口，会 fallback `0.0.0`——等效老归档行为）。

## Open Questions

1. **作者改版号规则**：同一 skill_id 第二次导出，默认 bump patch。如果作者改 story-spec 里的 `story_name` / `title`，是否视为新 skill（从 `0.1.0` 重开）？本提案倾向**不特殊处理**——按 `skill_id`（= slug）作 key，name 变了版本号也连续。
2. **catalog 展示的最小版本标签**：catalog 里混着 `0.0.0`（回填的老归档）和 `0.1.0`（新导出）时，`soulkiller skill list --catalog` 是否在 `0.0.0` 行加 `(legacy)` 徽章？本提案先不做，等观察。
3. **bumpPatch 失败时策略**：作者上次填了 `2026.04.15`，bumpPatch 正则不匹配；是 fallback 到"+`-1`"还是重置到 `0.1.0`？建议 fallback 到"原值 + `-1`" → `2026.04.15-1`。保留作者格式化意图。
