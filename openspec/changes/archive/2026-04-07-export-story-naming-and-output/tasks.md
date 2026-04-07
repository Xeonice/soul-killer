## 1. 类型和数据结构

- [x] 1.1 修改 `src/agent/export-agent.ts` 的 `PreSelectedExportData` 接口：新增 `storyName: string`, `storyDirection?: string`, `outputBaseDir: string`
- [x] 1.2 修改 `src/export/story-spec.ts` 的 `StorySpecConfig`：新增 `story_name: string` 和 `user_direction?: string` 字段
- [x] 1.3 修改 `src/export/packager.ts` 的 `PackageConfig`：新增 `story_name: string`，将 `output_dir?` 重命名为 `output_base_dir: string`（必填）

## 2. packager / getSkillDirName 重构

- [x] 2.1 `getSkillDirName` 签名改为 `(storyName: string, worldName: string)`，实现保持 kebab-case 逻辑
- [x] 2.2 `packageSkill` 内部使用 `config.story_name` 和 `config.output_base_dir`，移除 protagonist-based 推导
- [x] 2.3 更新 packager 中调用 `generateSkillMd` 的 description 构造：使用 `storyName` 而非 protagonist display name

## 3. generateStorySpec 增加新字段

- [x] 3.1 `generateStorySpec` 在 frontmatter 顶部增加 `story_name: <storyName>` 行
- [x] 3.2 若 `user_direction` 非空，在 frontmatter 增加 `user_direction: |` 多行块
- [x] 3.3 在文档体顶部新增 "# 故事身份" 章节展示 story_name 和 user_direction（给 SKILL.md 引擎和调试用）

## 4. generateSkillMd 使用故事名

- [x] 4.1 `SkillTemplateConfig` 新增 `storyName: string` 字段（必填），移除 `soulDisplayName`
- [x] 4.2 description 文本从 "与{soulDisplayName}的..." 改为 "{storyName} — 在{worldDisplayName}中的多角色视觉小说"
- [x] 4.3 intro 块和 buildSingleCharacterEngine 均使用 storyName

## 5. export-agent 适配

- [x] 5.1 `buildInitialPrompt` 增加"用户原始意图"块注入逻辑（storyDirection 存在时）
- [x] 5.2 `buildInitialPrompt` 增加"故事名"块
- [x] 5.3 `finalize_export` tool 的 inputSchema 移除 `output_dir` 参数（改为空 object）
- [x] 5.4 `finalize_export` execute 调用 `packageSkill` 时传入 `story_name` 和 `output_base_dir`；同时把 preSelected.storyName/storyDirection 注入 story_spec
- [x] 5.5 SYSTEM_PROMPT 新增"用户原始意图处理"段落，明确优先级规则

## 6. export.tsx Wizard 扩展

- [x] 6.1 新增 UIStep: `naming-story`、`story-direction`、`selecting-output`
- [x] 6.2 新增 state: `storyName`, `storyDirection`, `outputBaseDir`
- [x] 6.3 定义 `OUTPUT_OPTIONS` 常量：三个预设路径配置（default / project / global）
- [x] 6.4 实现 naming-story UI: TextInput overlay，空值时显示 inline 错误并保持当前步骤
- [x] 6.5 实现 story-direction UI: TextInput overlay，显示"Enter 跳过"提示
- [x] 6.6 实现 selecting-output UI: 复用 panel 的 select 模式展示三个选项
- [x] 6.7 Esc 导航: naming-story → selecting-world, story-direction → naming-story, selecting-output → story-direction
- [x] 6.8 selecting-world 确认后进入 naming-story
- [x] 6.9 selecting-output 确认后进入 loading-data
- [x] 6.10 beginExport 构造 PreSelectedExportData 时传入所有新字段

## 7. i18n

- [x] 7.1 新增 i18n keys（含 export.hint.optional 辅助 key）
- [x] 7.2 同步三语（zh/ja/en）

## 8. 测试适配

- [x] 8.1 更新 `tests/unit/export.test.ts`：generateStorySpec 传入 story_name；generateSkillMd 传入 storyName
- [x] 8.2 更新 `tests/unit/export-tools.test.ts`：getSkillDirName 测试改为故事名驱动；packageSkill 调用传入 story_name + output_base_dir
- [x] 8.3 `bun run build` 通过
- [x] 8.4 `bun run test` 通过（559 passed）

## 9. 验证

- [x] 9.1 完整 wizard 流程已实测：用户跑通了 souls → world → "FSN 反转的 HF 线" name → direction → 选择 ~/.claude/skills 输出位置；agent log 确认初始 prompt 包含意图与故事名块
- [~] 9.2 跳过 story direction — 待用户独立验证
- [~] 9.3 三种输出位置各验证一次 — 已验证 global (~/.claude/skills)，default 和 project 待用户验证
- [~] 9.4 story-spec.md frontmatter 验证 — 单元测试已覆盖 (export.test.ts 验证 story_name 字段写入)，待运行后查看
- [~] 9.5 SKILL.md description 使用故事名 — generateSkillMd 单元测试覆盖，待运行后查看
- [~] 9.6 用户原始意图块注入 — 通过 reasoning-delta 诊断已确认 agent 收到了完整 prompt（但触发了 glm-5 reasoning 漩涡，已通过排查定位为模型行为问题，与本 change 实现无关）
