## Why

SKILL.md Phase -1 使用 Glob 工具搜索 `runtime/scripts/*.json` 来判断是否有已生成的脚本。但 Claude Code 的 Glob 工具在 skill 目录下使用相对子路径时存在不可靠行为——文件确实存在却返回 0 结果，导致每次启动 skill 都误判为"首次游玩"，跳过脚本菜单直接进入 Phase 0。

## What Changes

- **新增 `soulkiller runtime scripts` 子命令**：扫描 `runtime/scripts/script-*.json`，解析每个脚本的头部字段（id、title、generated_at），输出结构化 JSON
- **修改 SKILL.md 模板**：Phase -1 Step -1.1 从依赖 Glob 工具搜索改为调用 `soulkiller runtime scripts` 命令判断已有脚本

## Capabilities

### New Capabilities

- `runtime-scripts-list`: 新增 CLI 子命令，列出 skill 归档中所有已生成的脚本及其元信息

### Modified Capabilities

- `skill-runtime-state`: Phase -1 脚本发现机制从 Glob 工具改为 CLI 命令

## Impact

- 文件变更：`src/export/state/main.ts`（新增 scripts 分支）、新建 `src/export/state/scripts.ts`、`src/export/skill-template.ts`（Phase -1 模板文本）
- 无依赖变更、无 API 变更
- 向后兼容：新命令对现有 skill 归档无影响，模板变更仅影响新导出的 skill
