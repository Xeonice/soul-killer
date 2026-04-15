## 1. 数据层：packager + builder

- [x] 1.1 新增 `src/export/support/bump-version.ts`：`bumpPatch(existing: string)` + `deriveDefaultVersion(existingSkillDir: string | null)` + `readExistingAuthorVersion(jsonPath: string)`
- [x] 1.2 `src/export/agent/types.ts` — `ExportBuilder` 新增 `private authorVersion` + `setAuthorVersion(v: string)`；`build()` 返回值 `story_spec` 添加 `author_version` 字段（缺省 `"0.0.0"`）；`StorySpecConfig` 加 `author_version?: string`
- [x] 1.3 `src/export/packager.ts` — 抽出 `buildSoulkillerManifest()` 函数；`soulkiller.json` 生成加 `version` 字段（取自 `story_spec.author_version`，缺省 `"0.0.0"`）
- [x] 1.4 单测 `tests/unit/export/support/bump-version.test.ts`：semver-3 / 两段式 / 日期三段（结构等价 semver 被 bump）/ 非标准字符串
- [x] 1.5 单测 `tests/unit/export/agent/export-builder-version.test.ts`：setter / 缺省 fallback / 空字符串拒绝 / 自由格式
- [x] 1.6 单测 `tests/unit/export/packager-author-version.test.ts`：buildSoulkillerManifest 各输入 → JSON 输出正确

## 2. Catalog 读取源修正

- [x] 2.1 `scripts/build-catalog.ts:114` 改读 `parsed.version`；缺字段 stderr 警告；导出 `buildEntry` + 用 `import.meta.main` 守护 `main()`
- [x] 2.2 单测 `tests/unit/scripts/build-catalog.test.ts`：author version / 缺字段 + warning / 空字符串 / 自由格式

## 3. 老归档回填

- [x] 3.1 `scripts/upgrade-example-skills.ts` — 升级流程检查 `soulkiller.json.version`，缺失时写 `"0.0.0"` 并 log
- [x] 3.2 `StaleReport.missingAuthorVersion` + inspectOne 填入；`runCheck` 把缺字段当过期原因，报告行
- [x] 3.3 跑 `bun scripts/upgrade-example-skills.ts`，3 个 example 的 `version` 字段已回填 `0.0.0`
- [x] 3.4 跑 `bun scripts/build-catalog.ts`，`dist/catalog.json` 已刷新，三个条目 `version: "0.0.0"`

## 4. 向导入口（REPL /export）

- [x] 4.1 向导步骤直接在 export.tsx 中实现，无需单独子组件；textInputInitialValue state + hint line
- [x] 4.2 `ExportCommand` 状态机加 `entering-version` phase，位于 `selecting-output` 之后；提交后 `beginExport(..., authorVersion)`；`preSelected.authorVersion` 传入 agent；`runExportAgent` 在 builder 构造后立刻 `builder.setAuthorVersion(preSelected.authorVersion)`
- [x] 4.3 `deriveDefaultVersion` 读 `outputBaseDir/baseName/soulkiller.json` 推导默认值（已在 bump-version.ts）
- [x] 4.4 `showVersionInput` 用 `deriveDefaultVersion` 预填；handleCancel 支持 Esc 回 selecting-output

## 5. i18n 文案

- [x] 5.1 `zh.json` 新增 `export.step.author_version` / `export.hint.author_version` / `export.err.author_version_required`
- [x] 5.2 `en.json` / `ja.json` 同步新增

## 6. Lint 规则

- [x] 6.1 `src/export/support/lint-skill-template.ts` 新增 `lintAuthorVersion()` 函数（检查 soulkiller.json 内容）；规则 `AUTHOR_VERSION_PRESENT` warn 不阻断；packager.ts 在 reports 数组里加一项
- [x] 6.2 单测 `tests/unit/export/lint-author-version.test.ts`：正常值 / 缺字段 / `0.0.0` / 空字符串 / 非法 JSON / 自由格式 6 种

## 7. 文档

- [x] 7.1 `README.md` 导出流程段落说明版本号输入 + 三种版本字段的语义对比
- [x] 7.2 `CLAUDE.md` "Export / Skill format" 段落插入 skill-author-version 变更说明

## 8. E2E

- [x] 8.1 `tests/e2e/08-export.test.ts` — 无需修改，测试在 "thinking" 阶段就终止；新 version step 不阻断原有断言；回归绿
- [x] 8.2 新增 `tests/e2e/21-export-version-step.test.ts`：3 个场景（首次默认 0.1.0 / 再次导出读旧版 bump patch / Backspace 清空后空值触发错误）全绿

## 9. 发布验证

- [x] 9.1 `bun run build`（tsc --noEmit）通过
- [x] 9.2 `bun run test` 全绿：**104 files / 1119 tests**；skill + export e2e 30/30 绿
- [x] 9.3 手工：`dist/catalog.json` 刷新后 3 个条目 `version: "0.0.0"`；`skill list` 会显示 `updatable` 当作者发布 >= 0.1.0
- [x] 9.4 `openspec archive skill-author-version` 已执行：delta → `openspec/specs/skill-author-version/spec.md`，change 归档到 `openspec/changes/archive/`
