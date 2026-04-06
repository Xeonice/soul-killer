## Why

Soulkiller 当前可以创建 Soul、构建 World、蒸馏和进化，但缺少将成果导出为可分发、可独立运行的产物的能力。用户需要一个统一的导出功能，将 Soul + World 组合打包为 Claude Code Cloud Skill，让其他人加载后获得完整的**视觉小说式交互体验**——角色扮演 + 世界观沉浸 + 分支剧情。

## What Changes

- 新增 **Export Agent**：Agent 驱动的导出流程（非固定向导），通过 tool calling 循环引导用户选择 Soul、自由选择 World（不限于已绑定）、配置剧本规约、选择目标路径，最终打包输出 Cloud Skill 目录
- 新增 **ExportProtocolPanel**：Agent 交互式可视化面板，支持进度轨迹 + 活动区交替展示（Agent 操作与用户输入交替进行）
- 新增 **Cloud Skill 产物格式**：包含 SKILL.md（视觉小说引擎调度器）、soul/ 目录、world/ 目录、story-spec.md（剧本生成规约）
- 新�� `/export` 命令注册到 REPL command registry
- 导出的 Skill 在 Cloud 运行时支持：动态剧本生成（Phase 1）、视觉小说交互循环（Phase 2），使用 AskUserQuestion 呈现选项
- 幕间过渡使用反思性选择（interlude choice）制造停顿感和情绪代入

## Capabilities

### New Capabilities
- `export-agent`: Export Agent 核心逻辑——Agent prompt、tool 定义（list_souls、list_worlds��read_soul、read_world、ask_user、package_skill）、Agent loop 驱动
- `export-protocol-panel`: Agent 交互式可视化面板——进度轨迹（ProgressTrail）、活动区（ActiveZone：tool 进度/内嵌选择/内嵌文本输入/打包进度/结果展示）、折叠策略
- `cloud-skill-format`: Cloud Skill 产物格式——SKILL.md 模板（视觉小说引擎 prompt）、story-spec.md 生成（基调/幕数/结局数/约束/seeds 占位）、目录结构与文件复制
- `export-command`: `/export` 命令注册、入口组件、interactiveMode 集成

### Modified Capabilities
- `repl-shell`: 新增 `/export` 命令路由
- `soul-package`: 导出时复用 `getBoundWorlds`、`readManifest`、`readSoulFiles` 等现有函数

## Impact

- **新增文件**：`src/agent/export-agent.ts`、`src/cli/animation/export-protocol-panel.tsx`、`src/cli/commands/export.tsx`、`src/export/skill-template.ts`、`src/export/story-spec.ts`、`src/export/packager.ts`
- **修改文件**：`src/cli/app.tsx`（命令路由）、`src/cli/command-registry.ts`（注册 /export）
- **依赖**：复用 Vercel AI SDK `ToolLoopAgent` + tool calling（与 capture-agent 相同模式）
- **输出目录**：用户可选——`.claude/skills/`（当前项目）、`~/.claude/skills/`（全局）、`~/.soulkiller/exports/`（默认）、或自定义路径
- **i18n**：新增 export 相关的 zh/en/ja 翻译 key
