## 1. 依赖与命名重构

- [x] 1.1 添加 `fflate` 依赖到 package.json (用 npm install 因 bun add 遇到证书错误)
- [x] 1.2 重命名 `getSkillDirName` → `getSkillFileName`，移除 `soulkiller:` 前缀，返回值带 `.skill` 后缀；同时新增 `getSkillBaseName` 返回不带后缀的版本
- [x] 1.3 更新所有调用点（packager.ts, export-agent.ts, tests）

## 2. PackageConfig / PackageResult 类型变更

- [x] 2.1 `PackageConfig.output_base_dir` 保持不变
- [x] 2.2 `PackageResult` 新结构：`{ output_file, file_count, size_bytes }`
- [x] 2.3 移除旧字段 `output_dir` 和 `files`

## 3. packageSkill 重写为 zip 归档

- [x] 3.1 引入 `fflate.zipSync` 和 `strToU8`
- [x] 3.2 内存文件映射构建（buildSoulFiles helper + world entries + story-spec + SKILL.md）
- [x] 3.3 调用 `zipSync(files)` 生成 Uint8Array
- [x] 3.4 写入 `<output_base_dir>/<file-name>.skill`
- [x] 3.5 `fs.mkdirSync(output_base_dir, { recursive: true })` 兜底
- [x] 3.6 文件冲突：先 `rmSync` 再写入（覆盖）
- [x] 3.7 无任何临时目录或展开目录

## 4. SKILL.md frontmatter 同步

- [x] 4.1 `generateSkillMd` 的 `skillName` 参数现在传入 baseName（无 `.skill` 后缀，无 `soulkiller:` 前缀）
- [x] 4.2 frontmatter `name` 字段直接使用 `skillName`
- [x] 4.3 packager 通过 `getSkillBaseName(storyName, worldName)` 得到 baseName 传给 generateSkillMd

## 5. export-agent finalize_export 适配

- [x] 5.1 finalize_export 内部使用 `result.output_file / file_count / size_bytes`
- [x] 5.2 onProgress complete 事件 payload 改为新字段
- [x] 5.3 返回给 LLM 的对象用新字段名

## 6. ExportProgressEvent 类型 + UI 适配

- [x] 6.1 `ExportProgressEvent.complete` 字段更新（output_file/file_count/size_bytes）
- [x] 6.2 `export-protocol-panel.tsx` 完成态：📦 .skill 路径 + "N files · X KB"
- [~] 6.3 i18n keys 不需要改动（现有文案是通用的"完成"提示，不引用目录概念）

## 7. 测试适配

- [x] 7.1 `tests/unit/export-tools.test.ts` 重写：
  - 新 `getSkillFileName` / `getSkillBaseName` 测试组（验证 `.skill` 后缀、无前缀、无空格、CJK 保留）
  - packager 集成测试：fflate.unzipSync 解压验证完整内部结构、SKILL.md frontmatter `name`、story-spec 内容
- [x] 7.2 `tests/component/export-protocol-panel.test.tsx`：
  - "renders complete result" 测试改用新 ActiveZoneState `complete` 字段
  - "handles complete event" reducer 测试同步更新
- [x] 7.3 `bun run build` 通过
- [x] 7.4 `bun run test` 通过（562 passed，新增 3 个 .skill 验证测试）

## 8. 验证

- [~] 8.1 手动测试：完整 export 流程 — 代码层已由单元测试覆盖（562 passed，含 .skill 归档结构验证），待用户端到端验证
- [~] 8.2 unzip 解压 .skill 验证结构 — 单元测试已用 fflate.unzipSync 验证完整内部结构，待用户系统 unzip 验证
- [~] 8.3 解压到 ~/.claude/skills/ 后 Claude Code 加载 — 依赖 Claude Code 加载行为，待用户验证
- [~] 8.4 三个输出位置各验证一次 — 上一 change 已验证，本 change 未改动路径逻辑
- [~] 8.5 SKILL.md frontmatter name 不带 soulkiller: — 单元测试已断言 (export-tools.test.ts)，待用户实测再次确认
