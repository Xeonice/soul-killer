## 1. World 维度体系与类型系统

- [x] 1.1 创建 `src/agent/world-dimensions.ts`：定义 WorldDimension 类型、9 维度的 WORLD_DIMENSIONS 常量（priority/description/distillTarget）、WORLD_DIMENSION_SIGNALS 信号正则、ALL_WORLD_DIMENSIONS/REQUIRED_WORLD_DIMENSIONS 常量
- [x] 1.2 在 `src/agent/world-dimensions.ts` 中实现搜索模板：FICTIONAL_UNIVERSE_TEMPLATES 和 REAL_SETTING_TEMPLATES（每维度 2-3 个模板），实现 `generateWorldSearchPlan()` 函数
- [x] 1.3 在 `src/agent/world-dimensions.ts` 中实现 `analyzeWorldCoverage()` 函数（至少 4 维度覆盖，2+ required 才能 report）
- [x] 1.4 创建 WorldType（`'fictional-existing' | 'fictional-original' | 'real'`）和 WorldClassification（`'FICTIONAL_UNIVERSE' | 'REAL_SETTING' | 'UNKNOWN_SETTING'`）类型定义，放入 `src/agent/world-dimensions.ts` 或独立文件
- [x] 1.5 为 world-dimensions 编写单元测试：覆盖 generateWorldSearchPlan、analyzeWorldCoverage、信号检测

## 2. World Tag 系统

- [x] 2.1 创建 `src/tags/world-taxonomy.ts`：定义 WorldTagCategory、WorldTagSet、emptyWorldTagSet()、getWorldTagAnchors()
- [x] 2.2 在 i18n 的 zh/en/ja 三个 locale 文件中添加 World Tag 锚点词翻译 key
- [x] 2.3 验证 `parseTags` 兼容 WorldTagCategory（如需调整则修改 `src/tags/parser.ts` 使其支持泛型 category）
- [x] 2.4 为 world-taxonomy 编写单元测试

## 3. 通用 Capture Agent 重构

- [x] 3.1 创建 `src/agent/capture-strategy.ts`：定义 CaptureStrategy 接口
- [x] 3.2 创建 `src/agent/capture-agent.ts`：提取通用 `runCaptureAgent()` 函数（ToolLoopAgent 配置、stream 消费、doom loop 检测、progress 事件）
- [x] 3.3 创建 `src/agent/soul-capture-strategy.ts`：将 `soul-capture-agent.ts` 中的 CAPTURE_SYSTEM_PROMPT、phase 逻辑、Soul 维度引用提取为 SoulCaptureStrategy
- [x] 3.4 重构 `src/agent/soul-capture-agent.ts`：`captureSoul()` 内部委托给 `runCaptureAgent(new SoulCaptureStrategy(), ...)`，保持函数签名不变
- [x] 3.5 重命名 `src/agent/dimensions.ts` → `src/agent/soul-dimensions.ts`，更新所有 import
- [x] 3.6 运行现有 Soul 相关测试确保重构无回归

## 4. World Capture Agent

- [x] 4.1 创建 `src/agent/world-capture-strategy.ts`：实现 WorldCaptureStrategy（World 专用系统提示词、9 维度搜索引导、WorldClassification 使用）
- [x] 4.2 在 `world-capture-strategy.ts` 中实现 World 的 reportFindings schema（dimension 使用 WorldDimension 9 值枚举）
- [x] 4.3 创建 `captureWorld()` 导出函数（委托给 `runCaptureAgent(new WorldCaptureStrategy(), ...)`），MAX_STEPS=35
- [x] 4.4 为 captureWorld 编写单元测试（mock search results）

## 5. Entry dimension 字段与 WorldManifest 扩展

- [x] 5.1 修改 `src/world/entry.ts`：EntryMeta 新增 `dimension?: WorldDimension`，更新 parseFrontmatter/serializeFrontmatter/parseEntryMeta
- [x] 5.2 修改 `src/world/manifest.ts`：WorldManifest 新增 worldType/classification/tags/sources/origin/evolve_history 字段，更新 createWorldManifest/createWorld/loadWorld（向后兼容默认值）
- [x] 5.3 定义 WorldEvolveHistoryEntry 接口
- [x] 5.4 更新 entry 和 manifest 的单元测试

## 6. World Distill 引入 dimension

- [x] 6.1 修改 `src/world/distill.ts`：classifyChunks prompt 增加 dimension 输出，接受可选 classification 参数
- [x] 6.2 修改 `src/world/distill.ts`：extractEntries 生成的 entry 带 dimension 字段
- [x] 6.3 GeneratedEntry 的 meta 类型更新为包含 `dimension?: WorldDimension`
- [x] 6.4 更新 world-distill 单元测试

## 7. SoulkillerProtocolPanel 泛化

- [x] 7.1 修改 `src/cli/animation/soulkiller-protocol-panel.tsx`：Props 新增 `mode`、`classificationLabels`，classification 类型改为 string
- [x] 7.2 标题根据 mode 切换（soul: "SOULKILLER PROTOCOL" / world: "WORLDFORGE PROTOCOL"）
- [x] 7.3 UNKNOWN 面板根据 mode 切换 classification 标签
- [x] 7.4 移除硬编码的 CLASSIFICATION_LABELS，改为 props 传入
- [x] 7.5 更新 soulkiller-protocol-panel 组件测试（新增 world mode 测试用例）
- [x] 7.6 更新 `src/cli/commands/create.tsx`（Soul CreateCommand）的 panel 调用，传入 mode='soul' 和 classificationLabels

## 8. WorldCreateWizard 重构

- [x] 8.1 重写 `src/cli/commands/world-create-wizard.tsx` 状态机：新增 type-select/tags/capturing/search-confirm/search-detail/data-sources/source-path/ingesting/distilling/review/bind-prompt 步骤
- [x] 8.2 实现 type-select 步骤（3 种 WorldType 选择）
- [x] 8.3 实现 tags 步骤（TextInput + LLM 解析 WorldTagSet）
- [x] 8.4 实现 capturing 步骤（调用 captureWorld + 渲染 SoulkillerProtocolPanel mode='world'）
- [x] 8.5 实现 search-confirm 步骤（confirm/retry/detail 三选项）和 search-detail 步骤
- [x] 8.6 实现 data-sources 步骤（CheckboxSelect 多选：web-search/markdown/url-list）
- [x] 8.7 实现 source-path 步骤（逐个收集选中数据源的路径）和 ingesting/distilling 步骤
- [x] 8.8 实现 review 步骤（复用 WorldDistillReview）
- [x] 8.9 实现 bind-prompt 步骤（有 soulDir 时询问是否绑定）
- [x] 8.10 实现 UNKNOWN_SETTING 处理逻辑（根据 WorldType 提供不同引导）

## 9. i18n 与菜单更新

- [x] 9.1 在 zh/en/ja locale 文件中添加所有新增 i18n key（WorldType 选项文案、Tags 提示、搜索进度、bind 引导等）
- [x] 9.2 修改 `src/cli/commands/world.tsx`：确保菜单「创建」正确渲染重构后的 Wizard（传入 soulDir）

## 10. 测试

- [x] 10.1 world-dimensions 单元测试（搜索计划、coverage 分析、信号检测）
- [x] 10.2 world-taxonomy 单元测试（emptyWorldTagSet、锚点词）
- [x] 10.3 capture-agent 通用逻辑单元测试（如可独立测试）
- [x] 10.4 world-create-wizard 组件测试（type-select、tags、confirm、bind-prompt 步骤的 snapshot）
- [x] 10.5 soulkiller-protocol-panel 组件测试更新（world mode snapshot）
- [x] 10.6 world-entry 和 world-manifest 单元测试更新（dimension 字段、新 manifest 字段）
- [x] 10.7 运行全量测试确保无回归：`bun run test`
