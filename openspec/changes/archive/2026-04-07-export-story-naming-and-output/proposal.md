## Why

上一轮 `export-staged-tool-calls` 解决了 agent 工具体系的拆分，但留下了三个用户控制层面的遗漏：

1. **Skill 命名不合理**：多角色场景下 `soulkiller:<protagonist>-in-<world>` 武断地把某一个角色当"代表"，不能准确反映这是一个"故事"。4 个角色选谁都不对。

2. **故事走向由 agent 全自主决定**：用户选完 souls + world 后，agent 直接开始生成，tone / constraints / 角色侧重全由 LLM 即兴发挥。用户没有任何注入意图的机会，只能接受或推翻重来。

3. **输出位置无处配置**：agent 只使用默认 `~/.soulkiller/exports/`。用户无法在 export 时选择导出到项目 `.claude/skills/` 或全局 `~/.claude/skills/`，只能事后手动 mv。

这三个都属于 "user-driven" 哲学的遗漏——机械决策（命名、路径、意图）本该由用户提供，而不是让 agent 猜或者固定死。

## What Changes

### Wizard 流程扩展

在现有的 selecting-souls → selecting-world 之后、load-data 之前，新增三个步骤：

```
selecting-souls
  ↓
selecting-world
  ↓
[NEW] naming-story          ← 必填: 故事名（直接作为 skill 身份）
  ↓
[NEW] story-direction       ← 可选: 故事走向描述（Enter 跳过）
  ↓
[NEW] selecting-output      ← 单选: 三个输出位置
  ↓
loading-data
  ↓
agent runs
  ↓
finalize_export
```

### Skill 命名从"协议:角色-in-世界"改为"协议:故事名-in-世界"

- **BREAKING**: `getSkillDirName` 签名改为 `(storyName, worldName)`
- 输出形如 `soulkiller:姐妹救赎-in-fate-stay-night/`
- CLI 对 storyName 做 kebab-case 转换作为目录名，但原名保留在 frontmatter 和 description 中

### 故事方向注入到 agent 上下文

- `PreSelectedExportData` 新增 `storyName: string` 和 `storyDirection?: string`
- `buildInitialPrompt` 将 storyDirection 作为"用户原始意图"块注入到 user message 顶部
- SYSTEM_PROMPT 增加指引：用户原始意图优先于 agent 的自主决策，但仍由 agent 翻译为 tone/constraints/axes

### 输出位置三选一

- 默认 `~/.soulkiller/exports/`（总是存在）
- 全局 Claude skills `~/.claude/skills/`（总是存在，agent 不检查）
- 项目 Claude skills `.claude/skills/`（总是存在，agent 不检查）

三个选项直接展示，用户单选。选完后 CLI 创建目录并传给 packager。

### Agent 不再处理 output_dir

- `finalize_export` tool 删除 `output_dir` 参数
- CLI 在调用 `runExportAgent` 前通过 `preSelected.outputBaseDir` 直接决定
- `packageSkill` 参数从 `output_dir` 改为 `output_base_dir`（语义: 在哪个根目录下创建 skill 子目录）

### story-spec.md 新增字段

frontmatter 新增：
- `story_name: string` — 故事名（非 kebab-case 的原始中文）
- `user_direction?: string` — 用户提供的故事方向（如有）

这两个字段主要给 SKILL.md 引擎和后续调试使用。

## Capabilities

### Modified Capabilities
- `export-agent`: runExportAgent 的 preSelected 数据新增 storyName/storyDirection/outputBaseDir；finalize_export tool 移除 output_dir 参数；SYSTEM_PROMPT 强调用户意图优先
- `export-command`: wizard 新增 naming-story / story-direction / selecting-output 三个 step；state 新增对应字段；Esc 导航适配

### New Capabilities
（无——这是对已有能力的流程扩展）

## Impact

- `src/agent/export-agent.ts` — PreSelectedExportData 扩展、buildInitialPrompt 注入 direction、finalize_export 移除 output_dir、SYSTEM_PROMPT 更新
- `src/cli/commands/export.tsx` — 新增 3 个 step 的 state 和 UI 处理
- `src/export/packager.ts` — `getSkillDirName(storyName, worldName)` 签名重构；`packageSkill({ story_name, output_base_dir, ... })`
- `src/export/story-spec.ts` — StorySpecConfig 新增 story_name / user_direction；generateStorySpec 输出新 frontmatter
- `src/export/skill-template.ts` — description 使用 storyName 而非 soulDisplayName
- `src/i18n/locales/*.json` — 新 i18n keys
- 测试：export.test.ts / export-tools.test.ts 适配新签名
- E2E：如有 export 场景测试，需更新
