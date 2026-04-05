## 1. 维度模型

- [x] 1.1 创建 `src/agent/dimensions.ts` — 定义 SoulDimension 类型、DIMENSIONS 常量（6 维度 + priority/description/distillTarget）
- [x] 1.2 在 dimensions.ts 中定义 DIMENSION_SIGNALS — 每个维度的正则关键词模式（中英文）
- [x] 1.3 在 dimensions.ts 中定义 SEARCH_TEMPLATES — 按 TargetClassification × SoulDimension 的推荐查询模板映射表，支持 {name}/{localName}/{origin} 占位符
- [x] 1.4 实现 `analyzeCoverage(extractions)` 函数 — 遍历 extractions 用 DIMENSION_SIGNALS 匹配，返回 CoverageReport（各维度 count/covered + totalCovered/requiredCovered/canReport/suggestion）
- [x] 1.5 实现 `generateSearchPlan(classification, englishName, localName, origin)` 函数 — 查表 SEARCH_TEMPLATES 生成搜索计划，替换占位符

## 2. 新增 Tools

- [x] 2.1 在 search-factory.ts 的 createAgentTools 中新增 `planSearch` tool — inputSchema 接收 summary 字符串，execute 内部解析分类/名称，调用 generateSearchPlan 返回计划
- [x] 2.2 在 search-factory.ts 的 createAgentTools 中新增 `checkCoverage` tool — inputSchema 接收 extractions 数组，execute 调用 analyzeCoverage 返回覆盖报告
- [x] 2.3 更新 `reportFindings` tool 的 inputSchema — extractions 数组每项新增 dimension 字段（z.enum 对应 6 个维度）

## 3. Agent 流程改造

- [x] 3.1 更新 prepareStep — 实现三阶段控制：step 0-1 只开放 search，step 2 强制 planSearch，step 3+ 全部开放
- [x] 3.2 更新 CAPTURE_SYSTEM_PROMPT — 加入 6 维度模型描述、搜索计划遵循指导、checkCoverage 使用指导、覆盖度完成标准
- [x] 3.3 更新 onStepFinish / fullStream 事件处理 — 新增 planSearch 和 checkCoverage 的 CaptureProgress 映射

## 4. 测试

- [x] 4.1 为 analyzeCoverage 编写单元测试 — 覆盖各种场景：空输入、部分覆盖、全覆盖、必需维度不足
- [x] 4.2 为 generateSearchPlan 编写单元测试 — 验证三种分类的计划生成和占位符替换
- [x] 4.3 确认类型检查通过、现有测试不回退
