## Context

Agent 的 `planSearch` 工具返回结构化的搜索计划（classification + 6 维度各 2-3 条推荐查询），`reportFindings` 的每条 extraction 都带 dimension 标签。这些数据在 `CaptureProgress` 事件和 UI 层没有充分利用。

`SoulChunk.metadata.extraction_step` 已保存了维度信息，但 search-confirm 和 search-detail 都没有读取它。

同时发现两个 agent 行为问题：(1) 模型倾向于将多条搜索结果合并为每维度 1 条大 extraction（实际搜了 80+ 结果最终只报告 6 条）；(2) checkCoverage 返回 canReport=true 后到 reportFindings 生成完毕之间有 1-2 分钟空白，UI 无反馈。

## Goals / Non-Goals

**Goals:**
- 用户能在搜索过程中看到搜索计划的维度概要和推荐查询
- 搜索完成后能看到各维度的覆盖分布
- 详情页每条数据有维度标签
- Agent 提交细粒度 extraction（每维度 3-8 条，总量 20-40）
- 搜索完成到报告生成之间有明确的 UI 反馈

**Non-Goals:**
- 不做维度可视化交互（筛选、折叠等）
- 不做自动重试（reportFindings 失败时由用户决定）

## Decisions

### D1: 新增 CaptureProgress 事件

`SearchPlanDimension` 接口包含 `dimension`、`priority`、`queries`：

```typescript
export interface SearchPlanDimension {
  dimension: string
  priority: string
  queries: string[]
}
```

当 `planSearch` tool-result 返回时，从输出中提取维度列表并发送 `search_plan` 事件。

### D2: 协议面板 — 搜索计划详情展示

在 classification 区块后独立展示搜索计划，每个维度显示优先级标签（必需/重要/补充）+ 前 2 条查询预览（截断 24 字符）：

```
▓ 搜索计划:
    identity     (必需)  Artoria Pendragon biogra… / 阿尔托莉雅 身份 背景
    quotes       (必需)  Artoria Pendragon quote… / 阿尔托莉雅 台词 语录
    ...
```

### D3: search-confirm — 维度覆盖统计

从 `agentChunks[].metadata.extraction_step` 统计各维度数量，用 bar 展示（最长维度 = 8 格）。

### D4: search-detail — 维度标签

每条 chunk 行头显示 `source · dimension`，从 `metadata.extraction_step` 读取。

### D5: Extraction Guidelines — System Prompt 强化

在 CAPTURE_SYSTEM_PROMPT 中新增 "Extraction Guidelines" 区块：
- 要求每维度 3-8 条，总量 20-40 条
- 禁止合并多条搜索结果为一条 extraction
- 要求保留原始内容（原文引用）而非总结
- 针对 quotes/identity/expression 维度给出具体拆分示例
- reportFindings 的 tool description 和 content 字段 description 同步强化

### D6: 报告生成阶段 UI 反馈

两层反馈：
1. checkCoverage 返回 canReport=true → 切换到 `filtering` 阶段 → 面板显示"正在整理调查报告..."
2. reportFindings tool-call 触发 → 显示为 📝 compiling report... 带 spinner

用 `filterProgress` 是否为空区分原有 filtering 逻辑和新的 compiling 状态。

### D7: 推荐模型新增 GLM-5

在 `RECOMMENDED_MODELS` 中新增 `z-ai/glm-5`，标签为 "Agent"，适合 tool calling 场景。

## Risks / Trade-offs

**[Extraction 数量要求过高]** → 部分模型（如 deepseek-v3.2）在尝试生成 20-40 条 extraction 时可能 token 超限，导致 tool call 格式退化为纯文本。Mitigation: 切换到 GLM-5 等 tool calling 能力更强的模型。

**[搜索计划查询预览截断]** → 24 字符截断可能丢失关键信息。Mitigation: 显示前 2 条最有代表性的查询，完整信息保留在 agent 日志中。
