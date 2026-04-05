## 1. CaptureProgress 新增 search_plan 事件

- [x] 1.1 新增 `SearchPlanDimension` 接口（dimension + priority + queries）和 `search_plan` 事件类型
- [x] 1.2 在 `tool-result` 处理中，planSearch 完成时从输出提取维度列表并发送 `search_plan` 事件

## 2. 协议面板展示搜索计划

- [x] 2.1 `SoulkillerProtocolPanelProps` 新增 `searchPlan` prop
- [x] 2.2 在 classification 区块后独立展示搜索计划（维度 + 优先级标签 + 前 2 条查询预览）
- [x] 2.3 `create.tsx` 处理 `search_plan` 事件，存入 state 并传给面板
- [x] 2.4 三语 i18n 新增 `protocol.dimensions`、`protocol.search_plan`、`protocol.priority.*` 标签

## 3. search-confirm 维度覆盖

- [x] 3.1 从 `agentChunks[].metadata.extraction_step` 统计各维度数量并渲染直方图
- [x] 3.2 三语 i18n 新增 `create.search.coverage` 标签

## 4. search-detail 维度标签

- [x] 4.1 每条 chunk 行头显示维度标签（`source · dimension`）

## 5. Extraction Guidelines — Agent 行为优化

- [x] 5.1 System prompt 新增 "Extraction Guidelines" 区块（每维度 3-8 条、总量 20-40、禁止合并、保留原文）
- [x] 5.2 reportFindings tool description 强化（"Submit 20-40 extractions total"）
- [x] 5.3 reportFindings content 字段 description 强化（单条信息、禁止合并、原始内容）

## 6. 报告生成阶段 UI 反馈

- [x] 6.1 checkCoverage canReport=true 后切换到 `filtering` 阶段（"正在整理调查报告..."）
- [x] 6.2 reportFindings 作为可见工具调用显示在面板中（📝 compiling report...）
- [x] 6.3 三语 i18n 新增 `protocol.compiling` 标签

## 7. 推荐模型新增 GLM-5

- [x] 7.1 `RECOMMENDED_MODELS` 新增 `z-ai/glm-5`，标签 "Agent"
- [x] 7.2 三语 i18n 新增 `model.pricing.glm5` 和 `model.tag.agent`
