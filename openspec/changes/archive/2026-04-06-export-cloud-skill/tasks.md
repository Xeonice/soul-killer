## 1. 基础设施

- [x] 1.1 在 `src/soul/package.ts` 中新增 `readSoulFiles(soulDir)` 函数，返回 identity/style/behaviors 完整文本
- [x] 1.2 创建 `src/export/` 目录结构：`packager.ts`、`skill-template.ts`、`story-spec.ts`
- [x] 1.3 新增 i18n 翻译 key（zh/en/ja）：export 命令描述、面板标题、步骤文本、完成提示等

## 2. Export Agent 核心

- [x] 2.1 创建 `src/agent/export-agent.ts`：定义 system prompt + 6 个 tools schema（list_souls、list_worlds、read_soul、read_world、ask_user、package_skill）
- [x] 2.2 实现 `list_souls` tool：扫描 souls 目录，返回摘要数组
- [x] 2.3 实现 `list_worlds` tool：扫描 worlds 目录，支持 bound_to_soul 过滤
- [x] 2.4 实现 `read_soul` tool：读取 manifest + 调用 readSoulFiles
- [x] 2.5 实现 `read_world` tool：读取 manifest + loadAllEntries
- [x] 2.6 实现 `ask_user` tool：通过回调 promise 与 UI 层交互（resolve on user response）
- [x] 2.7 实现 Agent loop（ToolLoopAgent + stepCountIs），接入进度事件回调

## 3. 打包与模板

- [x] 3.1 实现 `src/export/packager.ts`：package_skill 的核心逻辑——创建目录、复制 soul/world 文件
- [x] 3.2 实现 `src/export/skill-template.ts`：SKILL.md 模板生成——frontmatter + Phase 0/1/2 指令文本
- [x] 3.3 实现 `src/export/story-spec.ts`：story-spec.md 生成——frontmatter + 剧本规约文本，基于 Agent 收集的 genre/tone/acts/endings/constraints

## 4. ExportProtocolPanel 面板

- [x] 4.1 创建 `src/cli/animation/export-protocol-panel.tsx`：两区域布局骨架（ProgressTrail + ActiveZone），统一赛博朋克视觉风格
- [x] 4.2 实现 ProgressTrail：已完成步骤的折叠列表，展开/折叠策略（≤4 展开，>4 折叠早期步骤）
- [x] 4.3 实现 ActiveZone — Tool 调用进度：spinner + tool 名称 + 结果摘要
- [x] 4.4 实现 ActiveZone — 内嵌选择组件：上下箭头导航 + Enter 确认，支持 label + description
- [x] 4.5 实现 ActiveZone — 内嵌文本输入：文本框 + 已输入列表（用于 seeds 等多行输入）
- [x] 4.6 实现 ActiveZone — 打包进度：子步骤列表（✓/▸/○ 状态标记）
- [x] 4.7 实现 ActiveZone — 完成结果面板：输出目录树 + 使用提示
- [x] 4.8 实现底部状态栏：根据活动区状态动态切换快捷键提示

## 5. 命令集成

- [x] 5.1 创建 `src/cli/commands/export.tsx`：ExportCommand 组件，初始化 Agent + 挂载面板 + 桥接 ask_user 回调
- [x] 5.2 在 `src/cli/command-registry.ts` 中注册 `/export` 命令
- [x] 5.3 在 `src/cli/app.tsx` 的 handleInput 中添加 `export` case，设置 interactiveMode + 渲染 ExportCommand

## 6. 测试

- [x] 6.1 单元测试：readSoulFiles、packager（目录结构验证）、skill-template 生成、story-spec 生成
- [x] 6.2 单元测试：list_souls、list_worlds、read_soul、read_world tool 实现（packager 集成测试覆盖）
- [x] 6.3 组件测试：ExportProtocolPanel 各状态渲染（进度轨迹、选择组件、打包进度、完成面板）
- [x] 6.4 E2E 测试：`/export` 完整流程（mock LLM server 模拟 Agent 的 tool calling 响应）
