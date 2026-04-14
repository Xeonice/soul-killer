## 1. 基础设施：解压库统一化

- [x] 1.1 `package.json` 新增依赖 `nanotar`（^0.3.0）
- [x] 1.2 新建 `src/infra/archive/index.ts`：封装 `extractZip` / `extractTarGz` + `stripSingleRootDir` 选项 + 路径穿越保护
- [x] 1.3 `src/cli/updater.ts` 把 `execSync tar -xzf` 与 `powershell Expand-Archive` 都换成 `extractZip` / `extractTarGz` 调用
- [x] 1.4 `src/export/pack/unpacker.ts` 把 `execFile('tar', …)` 替换为 `extractTarGz`
- [x] 1.5 `tests/unit/infra/archive/archive.test.ts` 新增 10 条测试
- [x] 1.6 现有 `tests/unit/cli/updater.test.ts` 仍通过
- [x] 1.7 `bun run test` 全绿

## 2. catalog 客户端

- [x] 2.1 新建 `src/cli/catalog/client.ts`：`fetchCatalog` + 本地缓存读写（`~/.soulkiller/cache/catalog.json`）+ 7 天过期提示
- [x] 2.2 新建 `src/cli/catalog/types.ts`：CatalogV1 / SkillEntry 类型
- [x] 2.3 新建 `src/cli/catalog/url.ts`：flag > env > 默认值解析
- [x] 2.4 新建 `soulkiller skill catalog` 子命令（`src/cli/catalog/cli.ts`）：表格输出 / `--json`
- [x] 2.5 `tests/unit/cli/catalog/{url,client}.test.ts` 覆盖 fetch + 缓存降级 + URL 优先级 + schema 校验

## 3. 目标目录解析

- [x] 3.1 新建 `src/cli/skill-install/targets.ts`：4 个 target + 全局/项目路径解析
- [x] 3.2 openclaw + project 组合返回错误
- [x] 3.3 `cwd == homedir()` 警告逻辑
- [x] 3.4 `tests/unit/cli/skill-install/targets.test.ts`：17 条测试（三端路径 + 边界）

## 4. skill install 流水线

- [x] 4.1 `src/cli/skill-install/downloader.ts`：slug/url/path 三种源 + sha256 校验
- [x] 4.2 `src/cli/skill-install/extractor.ts`：解压 + strip + engine_version 兼容检查
- [x] 4.3 `src/cli/skill-install/installer.ts`：原子 rename + overwrite + 备份回滚
- [x] 4.4 `src/cli/skill-install/orchestrator.ts`：串联 download → extract → install → 多 target 分发 + 结构化结果
- [x] 4.5 注册 `soulkiller skill install` 到 `src/index.tsx`（并加 `catalog` 子命令）
- [x] 4.6 输出格式：成功/跳过/失败三类 + 重试命令建议
- [x] 4.7 `tests/unit/cli/skill-install/orchestrator.test.ts`：7 条全链路测试

## 5. REPL 向导：/install

- [x] 5.1 新建 `src/cli/commands/system/install.tsx`：多步骤向导（skill 选择 / target 选择 / scope / 预览 / 安装 / 结果）
- [x] 5.2 注册 `/install` 到 `src/cli/command-registry.ts` + `src/cli/commands/index.ts`
- [x] 5.3 支持 `/install <slug>` 预选
- [x] 5.4 Esc 行为：返回主界面（安装中不可中断）
- [x] 5.5 预览显式打印每条 (slug, target) 的绝对路径
- [ ] 5.6 `tests/component/commands/install.test.tsx` 交互测试（延后：复杂 ink 向导 + mock fetch，建议手动验证或加在后续轮次）
- [x] 5.7 i18n：`cmd.install` 三语

## 6. REPL 命令：/upgrade

- [x] 6.1 新建 `src/cli/commands/system/upgrade.tsx`：版本对比界面 + release notes 摘要
- [x] 6.2 简化决策：不在 REPL 内执行自更（JS 进程无法热换），引导用户退出后跑 `soulkiller --update`
- [x] 6.3 升级需重启的明示文案
- [x] 6.4 `/upgrade --check` 纯查询模式（args === '--check'）
- [x] 6.5 注册 `/upgrade` 到 command-registry + index
- [ ] 6.6 `tests/component/commands/upgrade.test.tsx`（延后：同 5.6，需 mock fetch GitHub API）
- [x] 6.7 i18n：`cmd.upgrade` 三语

## 7. skill list / skill upgrade 扩展

- [x] 7.1 `skill-manager.ts` 扫描 4 全局 + 3 项目目录
- [x] 7.2 `skillList()` 按 slug 合并，输出 targets 列（逗号分隔）
- [x] 7.3 跨目录 version drift 检测（⚠ 标记）
- [x] 7.4 `skillUpgrade` 对所有位置都升一遍
- [x] 7.5 `--all` 遍历全部 slug × 全部 location
- [ ] 7.6 `tests/unit/cli/skill-manager.test.ts` 扩展（延后：现有测试绿，新功能由 orchestrator 测试覆盖）

## 8. Worker + CI 集成

- [x] 8.1 新建 `scripts/build-catalog.ts`：扫描 `.skill`、解 `soulkiller.json` + frontmatter、算 sha256、生成 catalog.json
- [ ] 8.2 确定 `.skill` 档案在仓库 / CI 中的位置（**需用户决定**：留 `examples/skills/` 为默认目录，CI 集成在 wrangler publish 流程里）
- [ ] 8.3 `.github/workflows/` 或 wrangler 发布脚本新增 catalog 生成步骤（**需用户配合部署**）
- [ ] 8.4 Worker 路由 `/examples/catalog.json` 返回 JSON（**需用户在 Worker 侧启用 static assets 路径**）
- [ ] 8.5 staging 验证（**需用户手动**）
- [ ] 8.6 三款现有 skill 首次端到端验证（**需用户手动**）

## 9. README + 文档

- [x] 9.1 `README.md` 删三段 bash，换 `soulkiller skill install --all --to claude-code` 等示例 + 4 个 target 说明
- [x] 9.2 `README.en.md` 在 System Maintenance 加完整 skill CLI 示例（因 en/ja 无 pre-made bash 段，无删除）
- [x] 9.3 `README.ja.md` 同上
- [ ] 9.4 CLAUDE.md 命令章节补充 `/install` + `/upgrade` 语义（**延后**：非关键路径）
- [ ] 9.5 `openspec/specs/cloud-skill-format/spec.md` 按 catalog schema 对齐（**延后**：归档时由 opsx 流水线处理）

## 10. 收尾

- [x] 10.1 `bun run build` 通过
- [x] 10.2 `bun run test` 全绿（1059/1059）
- [x] 10.3 `bun run test:e2e` 通过（新增 `14-skill-catalog.test.ts` 3 条 + `15-skill-install.test.ts` 9 条；15 files 全绿）
- [ ] 10.4 实机跨平台验证（**需用户手动在 Windows / Linux 上跑一次 `soulkiller skill install --all --to claude-code`**）
- [x] 10.5 `openspec status --change add-skill-install` artifact 完整
- [ ] 10.6 发版打新 tag v0.5.0（**需用户授权发布**）
