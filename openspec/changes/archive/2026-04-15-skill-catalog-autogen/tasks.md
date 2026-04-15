## 1. 数据面（Phase A）：manifest + agent + wizard

- [x] 1.1 修改 `src/export/packager.ts` 的 `buildSoulkillerManifest` 入参，新增 `world_slug` / `world_name` / `summary` 三参数；JSON 输出追加三字段，缺失时默认 `""`
- [x] 1.2 更新 `tests/unit/export/packager-contract.test.ts`（或 `packager-manifest.test.ts`），新增三组断言：三字段在 JSON 中、类型均为 string、未传时为空字符串
- [x] 1.3 修改 `src/export/agent/types.ts` 的 `StoryMetadata` interface，新增三字段；`ExportBuilder.setMetadata` 透传；`build()` 将三字段传给 packager
- [x] 1.4 修改 `src/export/agent/story-setup.ts` 的 `set_story_metadata` tool：schema 新增三字段（z.string 描述 + 正则校验 slug / 单行校验 summary / 长度校验），`inputExamples` 补上真实示例
- [x] 1.5 更新 `src/export/agent/prompts.ts`（STORY_SETUP_PROMPT）增加三字段的产出指引：说明字段用途、格式约束、从哪里推断
- [x] 1.6 新增单测 `tests/unit/export/agent/story-setup-catalog-fields.test.ts`：覆盖合法输入、slug 非法字符、summary 换行、长度超限四个场景
- [x] 1.7 finalize bridge：在 `src/export/agent/finalize.ts` 的 `builder.build()` 之后、`packageSkill()` 之前，新增 `catalog_confirm_request` 事件触发 + await resolver；ExportBuilder 暴露 `getCatalogCandidates()`；ExportProgressEvent 加新事件类型；PackageConfig 新增可选 `catalog_info`
- [x] 1.8 export.tsx 新增 UIStep `entering-catalog-info`（含 sub-step：slug / world / summary）、`catalogConfirmResolverRef`、事件分支处理；三个 TextInput 预填候选 + 格式校验 + 空值阻止
- [x] 1.9 Esc 在 `entering-catalog-info` 任一 sub-step：resolver 回传"已取消"信号；finalize 跳过 packageSkill；export.tsx 退出 interactiveMode 回主 prompt
- [x] 1.10 新增组件测试覆盖 `entering-catalog-info`：全接受 Enter 一路到底、编辑后提交、空值阻止、格式非法阻止、Esc 取消导出
- [x] 1.11 运行 `bun run build && bun run test`，确保 Phase A 测试全绿

## 2. 自动化面（Phase B）：脚本 + README + CI

- [x] 2.1 新增 `scripts/build-skill-catalog.ts`：解析参数（默认 / `--check`）；扫 `examples/skills/*.skill`；对每个 `.skill` 用 `Bun.spawn(['unzip', '-p', file, '<dir>/soulkiller.json'])` 读 manifest，另读 `SKILL.md` 取 frontmatter `description` 作降级
- [x] 2.2 脚本实现字段降级三级：`world_slug → skill_id`，`world_name → "—"`，`summary → description → basename`；降级触发时 stderr 打 warning
- [x] 2.3 脚本检测 slug 重复（两个 skill 使用相同 world_slug），直接 exit 1
- [x] 2.4 脚本实现 markdown 表生成 + 占位符替换（`<!-- SKILLS:START -->` / `<!-- SKILLS:END -->`），表格三列 slug/世界/说明，按 slug 升序
- [x] 2.5 脚本实现 `--check` 模式：生成目标 README 内容，与磁盘内容 diff；一致 exit 0，不一致打印 unified diff 并 exit 1
- [x] 2.6 脚本缺占位符时 exit 1 并提示；单测覆盖这个分支
- [x] 2.7 新增测试 `tests/unit/scripts/build-skill-catalog.test.ts`：覆盖三字段齐全、降级（只缺 description、都缺）、slug 重复、占位符缺失、`--check` 一致与不一致六个场景
- [x] 2.8 在 `README.md` 中插入占位符段落（放在"可装列表"章节位置），首次手动 commit 成本为零——脚本下次运行会注入内容
- [x] 2.9 本地跑一次 `bun scripts/build-skill-catalog.ts` 生成初始表格并 commit README；校验三个现存 skill 全部走降级路径时表现
- [x] 2.10 修改 `.github/workflows/release.yml`：checkout 用 `fetch-depth: 0` + write 权限；在测试步骤之前加一步 "Sync skill catalog"：跑脚本；若 README 有变化则 `git commit` 后 `git push origin HEAD:main`
- [x] 2.11 在 release.yml 里为 push 步骤设置 `github-actions[bot]` 身份；commit 信息含 tag 版本号（`chore(readme): sync skill catalog for ${{ github.ref_name }}`）
- [x] 2.12 修改 `.github/workflows/ci.yml` 新增 `verify-skill-catalog` job，跑 `bun scripts/build-skill-catalog.ts --check`，对标 `verify-examples` 的配置
- [x] 2.13 本地起 act 或在 fork 仓库打 tag 跑一次 release.yml dry run，确认 push 回 main 不会循环触发 workflow，GITHUB_TOKEN 够用否（不够则记录到文档中，留 PAT 方案）

## 3. 回归 + 验收

- [x] 3.1 运行全套单测 + 组件测试（`bun run test`），确保原有测试未回归
- [x] 3.2 端到端本地 /export 一次（用某个现存 soul+world 组合），验证向导 `entering-catalog-info` 真实可用，产出的 `.skill` 根 manifest 含三字段
- [x] 3.3 对新导出的 `.skill` 跑 `build-skill-catalog.ts`，确认表格使用新字段而非降级路径
- [ ] 3.4 打一个测试 tag（如 `v0.0.0-catalog-test`）到 fork 仓库，跑完整 release workflow 验证 sync 步骤
- [x] 3.5 更新 CLAUDE.md 简述新能力（一段话解释 README 表格自动生成的机制、`world_slug` 字段的角色）
- [x] 3.6 在变更 archive 前，openspec validate 通过（`openspec validate skill-catalog-autogen --strict`）
