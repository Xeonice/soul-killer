## 1. 统一维度框架

- [x] 1.1 新建 `src/agent/dimension-framework.ts`: 定义 DimensionDef、DimensionPlan 接口，导出 signalsToRegex() 工具函数
- [x] 1.2 重构 `src/agent/soul-dimensions.ts`: 将 DIMENSIONS 常量改为遵循 DimensionDef 接口的 SOUL_BASE_DIMENSIONS，添加 source:'base'、signals(从现有 DIMENSION_SIGNALS 迁移)、queries(从现有模板迁移)
- [x] 1.3 重构 `src/agent/world-dimensions.ts`: 同上，改为 WORLD_BASE_DIMENSIONS
- [x] 1.4 从两个 dimensions 文件中导出 `getBaseDimensions(type: 'soul'|'world'): DimensionDef[]` 统一入口函数

## 2. Planning Agent 实现

- [x] 2.1 新建 `src/agent/planning-agent.ts`: 实现 runPlanningAgent() 函数，接收 type/name/hint/preSearchResults/classification
- [x] 2.2 实现 planning prompt: 包含基础维度定义、调整规则、扩展规则(0-6个, 需 signals+queries)、输出 JSON 格式
- [x] 2.3 实现输出解析: 从 LLM JSON 中提取 adjustments(基础维度调整) + extensions(扩展维度)，合并为 DimensionPlan
- [x] 2.4 实现校验逻辑: 基础维度未被删除、扩展 <= 6、总数 <= 15、每个扩展有 signals 和 queries。失败抛错不 fallback

## 3. Capture Agent 集成

- [x] 3.1 修改 `src/agent/capture-agent.ts`: 在 pre-search 之后、createAgentTools 之前调用 runPlanningAgent()，将 DimensionPlan 传入 createAgentTools
- [x] 3.2 修改 `src/agent/tools/search-factory.ts` 的 createAgentTools(): 新增 dimensionPlan 参数，用于构建动态 dimension enum
- [x] 3.3 改造 planSearch tool: execute 从 dimensionPlan 读取 queries，不再模板替换
- [x] 3.4 改造 checkCoverage tool: 从 dimensionPlan 的 signals 构建 RegExp 做检测(基础维度用原有精准 signals，扩展维度用 signalsToRegex)
- [x] 3.5 改造 reportFindings tool: dimension enum 从 dimensionPlan.dimensions.map(d => d.name) 动态构建

## 4. System Prompt 动态注入

- [x] 4.1 修改 SoulCaptureStrategy: systemPrompt 改为 buildSystemPrompt(dimensionPlan: DimensionPlan) 方法，维度描述段从 DimensionPlan 动态生成
- [x] 4.2 修改 WorldCaptureStrategy: 同上
- [x] 4.3 更新 CaptureStrategy 接口: systemPrompt 从字符串属性改为 buildSystemPrompt(plan: DimensionPlan) 方法

## 5. Manifest 持久化

- [x] 5.1 修改 world manifest(`src/world/manifest.ts`): 增加 dimensions 字段(DimensionDef[])，读取时如果缺失则用基础维度填充
- [x] 5.2 在 capture-agent.ts 中，Planning Agent 成功后将 dimensionPlan 附加到 CaptureResult，供上层写入 manifest
- [x] 5.3 修改 `src/world/distill.ts` 的 classify 阶段: 从 manifest 读取 dimensions 列表(含扩展维度)构建 classify prompt

## 6. 单元测试

- [x] 6.1 新增 `tests/unit/dimension-framework.test.ts`: 测试 DimensionDef 接口一致性、signalsToRegex CJK/英文转换
- [x] 6.2 新增 `tests/unit/planning-agent.test.ts`: 测试 prompt 构造、JSON 解析、校验逻辑(正常/超限/缺字段/JSON解析失败)
- [x] 6.3 更新 `tests/unit/dimensions.test.ts`: 适配 SOUL_BASE_DIMENSIONS 新结构
- [x] 6.4 更新 `tests/unit/world-dimensions.test.ts`: 适配 WORLD_BASE_DIMENSIONS 新结构
- [x] 6.5 search-factory 相关测试: 现有测试通过(dimensionPlan 是可选参数, 无参时走 legacy 路径)
