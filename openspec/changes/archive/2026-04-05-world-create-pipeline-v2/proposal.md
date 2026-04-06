## Why

当前 World 创建流程与 Soul 创建流程存在显著体验差距：World 缺少 AI 搜索能力、数据源只能单选不能组合、没有 Tag 系统、蒸馏过程只有纯文本进度。同时 World 的维度模型缺失（没有 species/figures 维度），WorldManifest 缺少 tags/worldType/evolve_history 等关键字段。需要将 World 创建链路升级到与 Soul 创建同等水平，并引入 World 专属的维度体系和标签系统。

## What Changes

- **新增 World 维度体系**：定义 9 个搜索维度（geography/history/factions/systems/society/culture/species/figures/atmosphere），含优先级和搜索模板，用于 Agent 搜索和蒸馏分类
- **通用化 Capture Agent**：将 `captureSoul` ���构为通用 capture agent，通过策略模式支持 Soul 和 World 两种搜索目标，共享搜索基础设施（search/extractPage/planSearch/checkCoverage/reportFindings）
- **新增 World 分类体系**：用户选择 WorldType（fictional-existing/fictional-original/real），Agent 分类 WorldClassification（FICTIONAL_UNIVERSE/REAL_SETTING/UNKNOWN_SETTING）
- **新增 World Tag 系统**：独立于 Soul TagSet 的 WorldTagSet（genre/tone/scale/era/theme），含 LLM 解析和锚点词
- **重构 WorldCreateWizard**：对齐 Soul 创建流程——类型选择→名称/描述→Tags 输入→确认→数据源选择（前置于搜索）→AI Agent 搜索（按维度展示结果）→搜索确认→蒸馏（带维度可视化面板）→审查→创建→引导 Bind。同名世界冲突时支持覆盖或补充（在已有数据基础上追加）
- **Entry 新增 dimension 字段**：在 EntryMeta 中添加可选 `dimension` 字段，与 scope（注入行为）解耦，用于语义分类
- **WorldManifest 扩展**：新增 worldType、classification、tags、sources、origin、evolve_history 字段
- **蒸馏视觉面板**：将 SoulkillerProtocolPanel 泛化为同时支持 Soul capture 和 World capture 的实时展示面板
- **创建完成后引导 Bind**：World 创建成功后，如果当前有加载的 Soul，引导用户将新世界绑定到 Soul

## Capabilities

### New Capabilities
- `world-dimensions`: World 搜索维度体系——9 维度定义、优先级、搜索模板、coverage 分析、dimension→scope 默认映射
- `world-type-system`: World 类型与分类体系——WorldType 用户选择、WorldClassification Agent 分类、分类驱动的流程分支
- `world-tag-system`: World 独立标签系统——WorldTagSet（genre/tone/scale/era/theme）、锚点词、LLM 解析
- `world-capture-agent`: World 专用 capture 策略——World 搜索 prompt、9 维度搜索模板（per classification）、coverage 规则（4/9 维度，2+ required）

### Modified Capabilities
- `soul-capture-agent`: 重构为通用 capture agent 架构，提取共享基础设施，Soul 搜索逻辑变为策略之一
- `world-create-wizard`: 完全重构——新增类型选择、Tags 输入、AI 搜索、多数据源组合、蒸馏面板、Bind 引导
- `world-entry`: EntryMeta 新增可选 `dimension` ��段（向后兼容）
- `world-manifest`: WorldManifest 扩展字段（worldType/classification/tags/sources/origin/evolve_history）
- `world-distill`: 蒸馏流程引入 dimension 分类（替代纯 scope 分类），蒸馏 prompt 按 WorldClassification 调整
- `soulkiller-protocol-panel`: 泛化为通用 capture 展示面板，支持 Soul 和 World 两种模式的维度/进度展示
- `world-commands`: `/world` 菜单的「创建」分支简化为直接渲染重构后的 Wizard

## Impact

- **重构** `src/agent/soul-capture-agent.ts` → 提取通用 capture agent + Soul 策略
- **新增** `src/agent/world-capture-agent.ts`（World capture 策略）
- **新增** `src/agent/world-dimensions.ts`（World 维度定义、搜索模板、coverage）
- **重构** `src/agent/dimensions.ts` → 可能重命名为 `soul-dimensions.ts` 以区分
- **新增** `src/tags/world-taxonomy.ts`（WorldTagSet 定义和锚点词）
- **重构** `src/cli/commands/world-create-wizard.tsx`（完全重写）
- **修改** `src/cli/animation/soulkiller-protocol-panel.tsx`（泛化）
- **修改** `src/world/manifest.ts`（WorldManifest 扩展字段）
- **修改** `src/world/entry.ts`（EntryMeta 新增 dimension）
- **修改** `src/world/distill.ts`（蒸馏 prompt 引入 dimension）
- **修改** `src/cli/commands/world.tsx`（菜单简化）
- **新增/修改** i18n key（zh/en/ja 三语言）
- **新增/修改** 组件测试和单元测试
