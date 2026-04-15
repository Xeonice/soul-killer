## Why

skill 作者发布时**没有地方写 "这个 skill 本身是什么版本"**。`soulkiller.json` 目前只有三个版本相关字段：

- `engine_version: number` — 运行契约版本，soulkiller 二进制决定
- `soulkiller_version: string` — 构建元数据，导出时的二进制版本
- `exported_at: string` — 时间戳

作者想表达 "我发布了 v1.0，现在修了个 bug 发布 v1.1" 的诉求完全无从落地。直接后果：

- `skill-manage-installed` 刚落地的 `soulkiller skill list` 的 `LOCAL` 列永远 `—`
- `soulkiller skill update` 永远触发不到 `updatable` 状态（因为前后版本永远都是 `null` 或 `soulkiller_version` 的 `"dev"`）
- `build-catalog.ts:114` 把 `version` 误取自 `soulkiller_version`，结果是 catalog 发出来的 "1.0.0" 也是构建版本而非作者版本
- 用户只能靠"强制重装"（刚加的兜底 action）走升级路径，语义不清

本 change 就是补上这个数据位 + 输入入口 + 流水线改造。

## What Changes

**数据 schema**
- `soulkiller.json` 新增 `version: string` 字段——作者在导出时指定的 skill 自身版本。
- 推荐 semver `MAJOR.MINOR.PATCH`，但**不强制格式**（作者可用 `2026.04.15` / `beta-3` 等）。

**作者输入入口**
- 导出向导（`/export` REPL 命令）在 prose style 步骤之后、Agent 执行之前**新增一步"skill version"prompt**。
- **必填** + 智能默认：
  - 首次导出该 skill → 默认 `0.1.0`，光标停在输入框，Enter 接受或手动改
  - 再次导出同 skill（目标路径已有旧 soulkiller.json）→ 读旧版本 bump patch（`1.0.3` → `1.0.4`）作为默认值
  - Ctrl-U 清空手填任意值
- 向导步骤的文案明确说明：这是 **skill 自己的版本**，跟 soulkiller 二进制版本、engine_version 是三件事。

**流水线改造**
- `ExportBuilder.setMetadata` 或 `finalize_export` 接受新的 `version` 参数，写入 `story_spec`。
- `packager.ts:282` 的 `soulkiller.json` 生成加 `version` 字段（取自 ExportBuilder）。
- `scripts/build-catalog.ts:114` 改为从归档的 `soulkiller.json.version` 读取；若缺则 fallback 为 `"0.0.0"` 并在 stderr 打警告。

**scanner 行为**（已有设施）
- `src/cli/skill-install/scanner.ts` 的 `readInstallRecord` 已经在读 `raw.version` 字段——本 change 让它真能读到值。不需要改 scanner 代码。
- `diff.ts` 的 `unknown-version` 状态保留，用于处理缺字段的老归档。

**老归档兼容**
- `scripts/upgrade-example-skills.ts` 在升级 example 时，若 `soulkiller.json` 缺 `version`，写入 `"0.0.0"`，并在 stdout 输出 `⚠ filled missing version: 0.0.0`。
- REPL Installed Tab 的"强制重装"action 保留——`0.0.0` 相比 catalog 的 `0.1.0+` 自动变成 `updatable`，用户看到 "Update to v0.1.0" 按钮。

**lint / 验证**
- `src/export/support/lint-skill-template.ts` 加一条规则：归档 `soulkiller.json` 缺 `version` 或值为 `"0.0.0"` 时输出 warning（不阻断，提醒作者下次填）。

## Capabilities

### New Capabilities
- `skill-author-version`: skill 作者版本号的端到端管线——向导输入 → ExportBuilder 持有 → soulkiller.json 写入 → build-catalog 读取 → scanner/diff 消费；含首次 `0.1.0` / 再次 bump patch 默认值、缺字段 fallback、lint 警告。

### Modified Capabilities
- `skill-manage`: `diff.ts` 的 `up-to-date` / `updatable` 判定本身不变；但**实际使用时从"永远 unknown"转为"能真正触发 updatable"**——不是代码改动，是数据链路补齐的下游效果。无需写 delta spec。

## Impact

**受影响代码**
- `src/export/packager.ts` — `soulkiller.json` 生成加 `version`
- `src/export/agent/types.ts` — `ExportBuilder` 新增 version 字段 + accessor
- `src/cli/commands/export/export.tsx` — 向导加 "skill version" 步
- `src/cli/commands/export/` 可能新增 `version-step.tsx` 子组件
- `scripts/build-catalog.ts:114` — 修 `version` 读取源
- `scripts/upgrade-example-skills.ts` — 回填缺失 `version`
- `src/export/support/lint-skill-template.ts` — 加 `AUTHOR_VERSION_PRESENT` 规则
- i18n — `export.version.*` 键

**受影响文档**
- `README.md` — 导出示例补 "填版本号" 一步
- `CLAUDE.md` — "## What is Soulkiller" 或 "Export / Skill format" 段落提一句 `version` 字段的语义

**数据 / 兼容**
- 向后兼容：老归档（缺 `version`）仍可安装、可扫描、可 list；升级链路给出 `0.0.0` 兜底。
- 重新导出所有 examples 是 follow-up（不在本 change 范围）：`bun scripts/upgrade-example-skills.ts` 运行一次把老 example 的 `version` 回填为 `0.0.0`；要真正给它们 `0.1.0` 起步需要作者走新导出流程。

**依赖**
- 无新 npm 依赖；仅使用现有 ink 组件和 fs。

**测试**
- 新增 ExportBuilder.setVersion 单测（validate、default 推导）
- 新增 build-catalog 读 version 字段单测
- 更新 packager 测试检查 `soulkiller.json.version` 字段出现
- E2E `/export` 向导增加 skill version 步骤的回归测试（基于现有 `tests/e2e/08-export.test.ts`）
