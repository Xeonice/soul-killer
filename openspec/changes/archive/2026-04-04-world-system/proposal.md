## Why

Soulkiller 的 Soul 目前是完全自包含的（identity/style/behaviors），缺少「世界观」这一维度。真实场景中，同一个 Soul 在不同上下文环境下应有不同表现——例如「正式会议」与「深夜酒吧」，或「赛博朋克世界」与「现实世界」。引入独立于 Soul 的 World 系统，可以让对话场景规则化、知识域可复用，同时保持 Soul 与 World 的解耦。这与 SillyTavern 的 Lorebook/World Info 概念类似，但适配 Soulkiller 的灵魂提取场景。

## What Changes

- 新增 `World` 实体：独立存储在 `~/.soulkiller/worlds/<name>/`，包含元数据和条目（entries）
- 新增 `Entry` 系统：每个条目是一个带 frontmatter 的 markdown 文件，支持三种触发模式（always/keyword/semantic）和四种 scope 分类（background/rule/lore/atmosphere）
- 新增 `Binding` 机制：Soul 通过 `bindings/` 目录引用 World，支持 N:M 关联、优先级排序、条目过滤、persona_context 覆写
- 新增 `World Distill`：从数据源（PDF、小说等）自动提取世界条目，复用现有 ingest pipeline + LLM 分类/聚合/提取，支持交互式审查
- 新增 `Template Engine`：Mustache 风格模板系统，用于 persona_context 和条目内容的变量插值
- 新增 `Context Assembler`：运行时组装 system prompt，按优先级合并 World 条目 + Soul 文件 + Recall 结果，管理 token budget
- 新增 CLI 命令：`/world create`、`/world entry`、`/world bind`、`/world unbind`、`/world list`、`/world show`、`/world distill`、`/world evolve`
- 修改 Soul 打包/分发流程：publish 时可选内联 World 快照，install 时处理 World 冲突

## Capabilities

### New Capabilities
- `world-manifest`: 世界实体的元数据定义、CRUD、版本管理和存储结构
- `world-entry`: 世界条目系统——frontmatter 格式、三种触发模式（always/keyword/semantic）、四种 scope 分类、priority 排序
- `world-binding`: Soul 与 World 的绑定机制——N:M 关联、order 优先级、条目过滤、persona_context 覆写
- `world-distill`: 从数据源自动提取世界条目——分类、聚合、LLM 提取、交互式审查
- `world-template`: Mustache 风格模板引擎——变量插值、条件渲染、条目间引用
- `world-context-assembly`: 运行时 context 组装——多世界条目合并、优先级排序、token budget 管理、触发匹配
- `world-commands`: CLI 命令集——create/entry/bind/unbind/list/show/distill/evolve

### Modified Capabilities
- `soul-package`: 打包时支持内联 World 快照，安装时处理 World 冲突解决
- `soul-conversation`: 对话时 system prompt 构建流程改为通过 Context Assembler 组装

## Impact

- **新增模块** `src/world/`：manifest、entry、binding、distill、resolver、template、context-assembler
- **修改** `src/soul/package.ts`：打包/安装流程增加 World 处理
- **修改** `src/cli/app.tsx`：新增 `/world` 命令路由、AppState 增加 world 相关状态
- **修改** `src/cli/command-registry.ts`：注册 world 系列命令
- **修改** 对话流程（目前在 app.tsx 的 handleChat）：从直接拼接 soul files 改为通过 Context Assembler
- **新增依赖**：可能需要 frontmatter 解析库（gray-matter 或轻量替代）
- **存储**：新增 `~/.soulkiller/worlds/` 目录结构
- **i18n**：新增 world 相关的翻译 key
