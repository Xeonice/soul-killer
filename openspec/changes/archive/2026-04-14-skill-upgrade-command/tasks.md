## 1. 模板拆分

- [x] 1.1 在 `src/export/spec/skill-template.ts` 中将引擎指令提取为独立函数 `generateEngineTemplate()`，返回 engine.md 内容字符串（纯通用，无故事参数）
- [x] 1.2 现有 `generateSkillMd()` 保留作为向后兼容；内容模板由 `skill-manager.ts` 的 `rebuildContentFromSources()` 负责
- [x] 1.3 定义 `CURRENT_ENGINE_VERSION` 常量（初始值 1），供 upgrade 命令比对
- [x] 1.4 `generateEngineTemplate()` 覆盖完整引擎流程，内容部分引用 SKILL.md

## 2. 导出流程适配

- [x] 2.1 修改 `src/export/packager.ts`，将 engine.md 和 soulkiller.json 写入 skill 归档
- [x] 2.2 SKILL.md 保持现有格式（向后兼容），engine.md 作为独立副本同时输出；upgrade 命令负责拆分

## 3. skill CLI 入口

- [x] 3.1 新建 `src/cli/skill-manager.ts`，实现 `skillList()` 函数：扫描 ~/.claude/skills/，识别 soulkiller skill（通过 soulkiller.json 或 runtime/ 目录），输出列表
- [x] 3.2 实现 `skillUpgrade(target)` 函数 — 常规升级路径：比对 engine_version，覆盖 engine.md，更新 soulkiller.json
- [x] 3.3 实现 `skillMigrate(skillDir)` 函数 — 首次迁移路径：从 story-spec.md + souls/ 目录提取数据，生成拆分文件，备份旧 SKILL.md，清理 runtime/lib/
- [x] 3.4 在 `src/index.tsx` 注册 `skill` 子命令（`soulkiller skill list` / `soulkiller skill upgrade`）

## 4. 测试

- [x] 4.1 新建 `tests/unit/cli/skill-manager.test.ts`，覆盖：skill 识别（legacy/modern）、版本检测、engine 模板内容验证
- [x] 4.2 generateEngineTemplate() 测试合并在 skill-manager.test.ts 中
