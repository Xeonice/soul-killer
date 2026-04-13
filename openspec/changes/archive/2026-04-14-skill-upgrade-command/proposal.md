## Why

soulkiller 版本更新时，已安装的 skill 归档中的 SKILL.md 包含旧版引擎指令（Phase 流程、CLI 命令说明、状态管理规则等），无法自动获取新版本的改进和 bug 修复。当前只能手动编辑每个 skill 的 SKILL.md，容易出错且不可维护。需要将引擎指令拆分为独立文件，并提供 CLI 命令实现一键升级。

## What Changes

- **拆分 SKILL.md**：将引擎指令（Phase 流程、Save System、DSL 规范、Prohibited Actions 等）提取为独立的 `runtime/engine.md`，SKILL.md 仅保留故事内容 + 引导语
- **新增 `soulkiller.json`**：skill 归档的版本标识文件，包含 engine_version 和 soulkiller_version
- **新增 `soulkiller skill upgrade` 命令**：扫描已安装 skill，检测版本，覆盖更新 engine.md
- **新增 `soulkiller skill list` 命令**：列出所有已安装的 soulkiller skill 及其版本状态
- **改造 `skill-template.ts`**：新导出的 skill 直接输出拆分后格式（SKILL.md + engine.md + soulkiller.json）
- **旧 skill 首次迁移**：从 story-spec.md + souls/ 目录重建内容部分，生成拆分后的文件
- **清理 runtime/lib/**：旧 skill 的 runtime/lib/*.ts 不再需要（runtime.ts 已改为内嵌执行），迁移时删除

## Capabilities

### New Capabilities

- `skill-upgrade`: CLI 命令扫描、检测、升级已安装 skill 的引擎指令
- `skill-engine-split`: SKILL.md 拆分为内容文件 + engine.md 引擎文件的架构

### Modified Capabilities

- `export-command`: 导出流程改为输出拆分后的三文件格式（SKILL.md + engine.md + soulkiller.json）

## Impact

- 文件变更：`src/cli/skill-manager.ts`（新建）、`src/export/spec/skill-template.ts`（拆分模板）、`src/index.tsx`（注册 skill 子命令）
- skill 归档结构变更：新增 `runtime/engine.md` 和 `soulkiller.json`，SKILL.md 内容缩减
- 向后兼容：旧格式 skill 通过首次迁移自动转换，旧版 soulkiller 二进制可以读新格式 SKILL.md（引导语会指示 LLM 读 engine.md）
- runtime/lib/*.ts 在迁移时被清理（已无实际用途）
