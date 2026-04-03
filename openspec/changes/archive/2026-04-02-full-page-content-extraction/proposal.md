## Why

两个问题导致蒸馏结果错误：

1. **搜索只拿到 snippet**：DuckDuckGo HTML 搜索只返回每个结果的一两句摘要，而 Fandom Wiki 页面有几千字的角色设定、台词、性格分析。Agent 拿到的是"Johnny Silverhand is a fictional character in Cyberpunk 2077"这种一句话，而不是完整的角色 wiki 内容。

2. **蒸馏 prompt 没有目标人物上下文**：prompt 说"分析这个人的沟通风格"，LLM 把搜索结果文章的写作风格当成了目标人物的说话风格。需要在 prompt 中明确目标人物是谁，让 LLM 知道要从第三方描述中提取目标人物本身的特征。

## What Changes

- 新增页面内容抓取工具：搜索到 URL 后，用 `@mozilla/readability` + `jsdom` + `turndown` 提取目标页面完整正文并转为 Markdown（纯开源，零 API 依赖）
- 搜索工具重构：DuckDuckGo 搜索改为"搜 URL → 抓取 top N 页面完整内容"两步
- 蒸馏 prompt 注入目标人物名字：所有三个 prompt（identity/style/behavior）加上 `{name}` 上下文，明确告诉 LLM 要分析的是谁

## Capabilities

### New Capabilities

- `page-content-extractor`: 页面内容提取器——fetch URL → jsdom 解析 → readability 提取正文 → turndown 转 Markdown。纯本地，无外部 API

### Modified Capabilities

- `soul-capture-agent`: 搜索结果从 snippet 升级为完整页面内容
- `soul-distill`: 蒸馏 prompt 注入目标人物名字

## Impact

- **新增依赖**: `@mozilla/readability`, `jsdom`, `turndown`, `@types/turndown`
- **新增文件**: `src/agent/tools/page-extractor.ts`
- **修改文件**: `src/agent/tools/web-search.ts`, `src/agent/soul-capture-agent.ts`, `src/distill/extractor.ts`
