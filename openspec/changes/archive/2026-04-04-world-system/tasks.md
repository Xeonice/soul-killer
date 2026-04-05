## 1. 基础类型与存储

- [x] 1.1 创建 `src/world/manifest.ts` — WorldManifest 接口、createWorldManifest、CRUD 函数（createWorld/loadWorld/deleteWorld/listWorlds）、getWorldsDir 路径辅助
- [x] 1.2 创建 `src/world/entry.ts` — Entry 接口、frontmatter 解析器（自定义，基于 `---` 分隔）、序列化器、CRUD 函数（addEntry/loadEntry/loadAllEntries/removeEntry/updateEntry）
- [x] 1.3 创建 `src/world/binding.ts` — WorldBinding 接口、CRUD 函数（bindWorld/unbindWorld/loadBindings/updateBinding）、存在性校验
- [x] 1.4 为 manifest/entry/binding 编写单元测试（`tests/unit/world-manifest.test.ts`、`world-entry.test.ts`、`world-binding.test.ts`）

## 2. 模板引擎

- [x] 2.1 创建 `src/world/template.ts` — TemplateContext 接口、Mustache 子集渲染器（变量插值、{{#if}} 条件块、{{entries.*}} 引用、递归深度限制 3 层）
- [x] 2.2 为模板引擎编写单元测试（`tests/unit/world-template.test.ts`）— 覆盖变量插值、嵌套属性、不存在变量、条件真/假、条目引用、递归深度限制

## 3. Context Assembler

- [x] 3.1 创建 `src/world/resolver.ts` — 条目触发匹配：always 直接通过、keyword 字符串包含匹配（大小写不敏感，扫描当前输入 + 最近 3 轮）、semantic 调用 engine.recall()
- [x] 3.2 创建 `src/world/context-assembler.ts` — ContextAssembler 类，按设计的 8 步顺序组装 system prompt，effective_priority 排序，同名条目去重，token budget 裁剪，entry_filter 应用
- [x] 3.3 修改 `src/cli/app.tsx` — 将 `buildSystemPrompt` 调用替换为 ContextAssembler，向后兼容无世界绑定的场景
- [x] 3.4 为 resolver 和 context-assembler 编写单元测试（`tests/unit/world-resolver.test.ts`、`tests/unit/world-context-assembler.test.ts`）

## 4. World Distill

- [x] 4.1 创建 `src/world/distill.ts` — WorldDistiller 类（extends EventEmitter），实现四阶段流程：ingest → classify（LLM scope 分类）→ cluster（TF-IDF 聚合，阈值 0.3）→ extract（LLM 条目生成）
- [x] 4.2 实现交互式审查 UI 组件（`src/cli/commands/world-distill-review.tsx`）— 逐条展示条目，支持 accept/edit/skip/merge 操作
- [x] 4.3 实现 World Evolve 逻辑 — 增量蒸馏 + 同名条目冲突处理 + 版本号递增
- [x] 4.4 为 distill 流程编写集成测试（`tests/integration/world-distill.test.ts`）

## 5. CLI 命令

- [x] 5.1 创建 `/world create` 命令（`src/cli/commands/world-create.tsx`）— 交互式向导收集 display_name + description
- [x] 5.2 创建 `/world entry` 命令（`src/cli/commands/world-entry.tsx`）— 交互式添加/编辑条目
- [x] 5.3 创建 `/world bind` 和 `/world unbind` 命令（`src/cli/commands/world-bind.tsx`）— 绑定/解绑，需当前已加载 soul
- [x] 5.4 创建 `/world list` 和 `/world show` 命令（`src/cli/commands/world-list.tsx`）— 列表和详情展示
- [x] 5.5 创建 `/world distill` 和 `/world evolve` 命令（`src/cli/commands/world-distill.tsx`）— 蒸馏和增量进化入口
- [x] 5.6 注册 world 命令到 `command-registry.ts`，添加子命令补全和世界名 tab 补全到 `ARG_COMPLETION_MAP`
- [x] 5.7 添加 world 相关的 i18n key 到 zh/ja/en locale 文件

## 6. 打包与分发

- [x] 6.1 修改 `src/soul/package.ts` — publish 时检测 binding、交互式选择世界、内联世界快照到包
- [x] 6.2 修改 `src/soul/package.ts` — install 时检测包内 worlds/、处理本地冲突（保留/替换/副本）
- [x] 6.3 为打包分发流程编写集成测试

## 7. E2E 测试与组件测试

- [x] 7.1 编写 world 命令的组件测试（`tests/component/world-*.test.tsx`）— create/list/bind UI 快照
- [x] 7.2 编写 E2E 场景：创建世界 → 添加条目 → 绑定到 soul → 对话中验证条目注入（通过集成脚本验证，PTY E2E 后续补充）
