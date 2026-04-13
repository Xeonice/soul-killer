## 1. 实现 scripts 子命令

- [x] 1.1 新建 `src/export/state/scripts.ts`，实现 `runScripts(skillRoot)` 函数：扫描 `runtime/scripts/script-*.json`，解析头部字段，返回结构化结果
- [x] 1.2 在 `src/export/state/main.ts` 中注册 `scripts` 子命令，调用 `runScripts` 并输出 JSON

## 2. 更新 SKILL.md 模板

- [x] 2.1 在 `src/export/skill-template.ts` 中修改 Phase -1 Step -1.1，将 Glob 搜索指令替换为 `soulkiller runtime scripts` 命令

## 3. 测试

- [x] 3.1 新建 `tests/unit/export/state/scripts.test.ts`，覆盖：多脚本、无脚本、损坏文件、非脚本文件忽略
