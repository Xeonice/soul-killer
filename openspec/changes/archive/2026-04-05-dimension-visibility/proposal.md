## Why

创建流程中，搜索计划（planSearch 返回的 6 维度查询策略）和最终维度覆盖分布对用户完全不可见。用户只看到"生成搜索计划 → 1 条结果 ✓"和"碎片: 47 条"，无法判断搜索质量和维度均衡度。详情页也只显示 source + content，没有维度标签，无法理解每条数据的用途。

此外，Agent 的 extraction 质量存在两个问题：(1) 模型倾向于将大量搜索结果合并为每维度 1 条 extraction，导致数据粒度过粗；(2) 搜索完成到报告生成之间的等待无 UI 反馈，用户以为卡死。

## What Changes

- 新增 `CaptureProgress` 事件类型 `search_plan`（含维度列表 + 优先级 + 推荐查询），透传给 UI
- 协议面板阶段二完成后展示搜索计划详情（每个维度的优先级 + 前 2 条查询预览）
- search-confirm 页面新增维度覆盖直方图，从 `agentChunks[].metadata.extraction_step` 统计各维度数量
- search-detail 详情页每条 chunk 显示维度标签
- **Agent system prompt 新增 "Extraction Guidelines"**，要求每维度 3-8 条、总量 20-40 条独立 extraction，禁止合并/总结
- **reportFindings schema description 强化**，引导模型提交细粒度数据
- **checkCoverage canReport=true 后切换到 filtering 阶段**，显示"正在整理调查报告..."
- **reportFindings 作为可见工具调用**，显示在面板中（📝 compiling report...）
- **推荐模型列表新增 GLM-5** (`z-ai/glm-5`)

## Capabilities

### New Capabilities

### Modified Capabilities
- `soul-capture-agent`: `CaptureProgress` 新增 `search_plan` 事件；system prompt 新增 Extraction Guidelines；reportFindings 发送 tool_call progress 事件；checkCoverage canReport 后切换 filtering 阶段
- `soulkiller-protocol-panel`: 搜索计划详情展示（维度 + 优先级 + 查询预览）；reportFindings 图标；filtering 阶段新增"正在整理调查报告..."文案

## Impact

- **修改文件**:
  - `src/agent/soul-capture-agent.ts` — 新 progress 事件、system prompt extraction guidelines、reportFindings/checkCoverage progress
  - `src/agent/tools/search-factory.ts` — reportFindings schema description 强化
  - `src/cli/animation/soulkiller-protocol-panel.tsx` — 搜索计划展示、reportFindings 图标、compiling 文案
  - `src/cli/commands/create.tsx` — search-confirm 维度覆盖 + search-detail 维度标签 + search_plan 事件处理
  - `src/config/schema.ts` — 推荐模型新增 GLM-5
  - `src/i18n/locales/{zh,en,ja}.json` — 新增标签
