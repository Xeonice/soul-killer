## Context

搜索收集 368 篇文章，其中大量噪音（同名歧义：三国杀/火锅店/日本公司/游戏 mod）。现有评分打了分但没过滤。distillFromCache 截断到 8000 chars，高概率截到噪音。prompt 无防幻觉约束，LLM 编造了宋朝和外星种族内容。

## Goals / Non-Goals

**Goals:**
- 两步过滤彻底去噪：标题过滤 → 内容评分 → 只保留合格文章
- distill 只看合格文章全文，不截断
- prompt 防止 LLM 幻觉

**Non-Goals:**
- 不改变搜索引擎后端
- 不改变 Planning Agent

## Decisions

### Decision 1: 标题快速过滤

搜索完成后、内容评分前，一次 LLM 调用批量审查所有文章标题：

```
输入: 所有维度的 [{index, title, url, dimension}] (368 条标题)
prompt: "以下是为目标「三国」搜索的文章。标记每篇是否与目标相关。
         drop: 明显不相关（餐厅/手游/无关公司/其他朝代/其他作品）
         keep: 可能相关或无法仅从标题判断"
输出: JSON [{index, keep: true/false}]
```

一次调用，~5K tokens。把 drop 的文章从缓存中移除。

### Decision 2: 内容评分后写 filtered cache

现有的 `scoreDimensionsParallel` 已经按维度评分。评分后：
- 只保留 score ≥ 3 的文章
- 按评分从高到低排序
- 覆盖写入维度缓存文件（替换原始未过滤的数据）

这样 distillFromCache 读到的已经是过滤且排序后的数据。

### Decision 3: distillFromCache 取全文不截断

改为：
- 读取维度缓存的所有文章（已过滤，通常 3-10 篇合格文章）
- 全部文章全文拼接
- 如果总长度超过模型上下文限制（约 150K chars），按评分从高到低截取到限制内
- 不再硬截断到 8000 chars

### Decision 4: distill prompt 防幻觉

增加：
```
Target: "${worldName}" (${classification})

CRITICAL RULES:
- ONLY extract information from the provided articles. Do NOT add information from your own knowledge.
- Every fact in an entry MUST be traceable to one of the provided articles.
- If the articles don't contain enough information for a topic, generate FEWER entries rather than making up content.
```

## Risks / Trade-offs

- **[标题过滤误杀]** "Political systems of Imperial China" 标题不明确是哪个朝代，可能被误 drop。缓解：prompt 说"无法仅从标题判断的标记 keep"。
- **[合格文章全文可能很长]** 单篇 Exa 全文可能 100K+ chars（如 Wikipedia 长文、PDF 学术论文）。缓解：超过 30K chars 的文章先 LLM 识别章节结构，只保留与当前维度相关的章节。大部分文章 <10K chars 不受影响。
