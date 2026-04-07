## Why

三国世界创建产出了宋朝城市商业、Ama 外星种族等完全不相关的 entries。根因追踪：

1. 搜索结果 50%+ 是噪音（火锅店 Yelp、三国杀手游、日本公司、水浒传 Wikipedia）
2. 质量评分打了分但没有过滤——垃圾文章仍然留在缓存中
3. distillFromCache 读取缓存时截断到 8000 chars，高概率截到的是垃圾文章（按搜索顺序排列，不是按质量排序）
4. distill prompt 没有目标名称锚定和防幻觉约束，LLM 基于垃圾文章编造内容

需要两步过滤：标题快速过滤（批量去噪）+ 内容深度评分（质量排序），过滤后的合格文章全文传给 distill。

## What Changes

- 新增标题快速过滤：搜索完成后，一次 LLM 调用批量审查所有文章标题，标记 keep/drop
- 从缓存中剔除 drop 的文章，再进入内容评分
- 内容评分后，只保留 score ≥ 3 的文章写入 filtered cache
- distillFromCache 读取时按评分排序取全文（不截断），如果总量超过模型上下文则按分数从高到低取 top N
- distill prompt 增加目标名称锚定 + 防幻觉约束 + 来源 URL 要求

## Capabilities

### New Capabilities
- `title-filter`: 批量标题过滤，一次 LLM 调用审查所有文章标题
- `filtered-cache`: 评分后只保留合格文章的过滤缓存

### Modified Capabilities
- `distill-from-cache`: 读取过滤后的缓存，按评分排序取全文，prompt 增加防幻觉约束

## Impact

- 新增 `src/agent/search/title-filter.ts` — 标题快速过滤
- 修改 `src/agent/capture-agent.ts` — 搜索后插入标题过滤，评分后写 filtered cache
- 修改 `src/world/distill.ts` — distillFromCache 改为读 filtered cache 全文 + prompt 加约束
