## 1. 依赖安装

- [x] 1.1 安装 `@mozilla/readability`, `jsdom`, `turndown`, `@types/turndown`, `@types/jsdom`

## 2. Page Content Extractor

- [x] 2.1 创建 `src/agent/tools/page-extractor.ts`：fetch → jsdom → readability → turndown → Markdown（限 3000 字）
- [x] 2.2 实现超时处理（5s）、非 HTML 跳过、fetch 失败返回 null
- [x] 2.3 实现并行抓取函数 extractPagesParallel

## 3. 搜索工具改造

- [x] 3.1 修改 `web-search.ts`：DuckDuckGo 搜索后对 top 3 URL 用 page-extractor 抓取完整内容
- [x] 3.2 修改 `search-factory.ts`：Tavily 结果 content < 200 字时触发 page-extractor

## 4. 蒸馏 Prompt 注入名字

- [x] 4.1 修改 `extractor.ts`：extractFeatures 接收 `targetName` 参数
- [x] 4.2 三个 prompt 注入 {name}，明确"要分析的是目标人物，不是文章"
- [x] 4.3 修改 create.tsx 和 distill.tsx 传入 targetName

## 5. 测试

- [x] 5.1 page-extractor：HTML → readability → turndown → Markdown
- [x] 5.2 page-extractor：超时返回 null
- [x] 5.3 page-extractor：非 HTML 返回 null
- [x] 5.4 page-extractor：内容超 3000 字截断
- [x] 5.5 page-extractor：并行抓取，部分失败不影响成功的
- [x] 5.6 page-extractor：HTTP 错误返回 null
- [x] 5.7 web-search 二次抓取：snippet 被完整内容替换 + 页面失败时保留原 snippet
- [x] 5.8 集成测试：真实 Wikipedia 英文/中文页面抓取 + 并行抓取 + 不存在页面
- [x] 5.9 回归：199 个测试全部通过（178 单元/组件 + 21 集成）
